<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from './api';
import type { Meta, InboxRow, ExtensionRequestDetail, RenterPickerEntry, Message } from './types';
import AppHeader from './components/AppHeader.vue';
import InboxList from './components/InboxList.vue';
import RequestDetail from './components/RequestDetail.vue';
import DemoPhone from './components/DemoPhone.vue';

const meta = ref<Meta | null>(null);
const inboxRows = ref<InboxRow[]>([]);
const selectedId = ref<string | null>(null);
const detail = ref<ExtensionRequestDetail | null>(null);
const renters = ref<RenterPickerEntry[]>([]);
const selectedRenterId = ref<string | null>(null);
const phoneMessages = ref<Message[]>([]);

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

async function refresh() {
  inboxRows.value = await api.inbox();
  if (selectedId.value) {
    await loadDetail(selectedId.value);
  }
  if (selectedRenterId.value) {
    phoneMessages.value = await api.messages(selectedRenterId.value);
  }
}

async function withErrorAlert(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    alert((e as Error).message);
  }
}

async function onReset() {
  await withErrorAlert(async () => {
    await api.reset();
    meta.value = await api.meta();
    renters.value = await api.renters();
    selectedId.value = null;
    detail.value = null;
    inboxRows.value = await api.inbox();
    if (inboxRows.value[0]) {
      await selectRow(inboxRows.value[0].id);
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

onMounted(async () => {
  const [metaRes, inboxRes, rentersRes] = await Promise.all([api.meta(), api.inbox(), api.renters()]);
  meta.value = metaRes;
  inboxRows.value = inboxRes;
  renters.value = rentersRes;
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
    <AppHeader :meta="meta" current-page="demo" @reset="onReset" />
    <div class="grid grid-cols-[300px_minmax(0,1fr)_360px] flex-1 min-h-0">
      <InboxList
        :rows="inboxRows"
        :selected-id="selectedId"
        :timezone="meta?.timezone ?? 'America/New_York'"
        :now-iso="meta?.now ?? new Date().toISOString()"
        @select="selectRow"
      />
      <RequestDetail
        v-if="detail"
        :detail="detail"
        :timezone="meta?.timezone ?? 'America/New_York'"
        :now-iso="meta?.now ?? new Date().toISOString()"
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
