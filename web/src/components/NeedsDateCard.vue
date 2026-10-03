<script setup lang="ts">
import { ref } from 'vue';
import { DateTime } from 'luxon';
import DateTimePicker from './ui/DateTimePicker.vue';

const { draft, timezone } = defineProps<{ draft: string; timezone: string }>();
const emit = defineEmits<{ sendQuestion: [text: string]; setDate: [iso: string] }>();

const questionText = ref(draft);
const dateValue = ref('');

function sendQuestion() {
  emit('sendQuestion', questionText.value.trim());
}

function checkCalendar() {
  if (!dateValue.value) return;
  const iso = DateTime.fromISO(dateValue.value, { zone: timezone }).toUTC().toISO();
  if (iso) emit('setDate', iso);
}
</script>

<template>
  <div class="bg-surface border border-line rounded-card p-5 flex flex-col gap-3">
    <div class="font-semibold text-ink">The message has no date. Ask the renter.</div>
    <textarea
      v-model="questionText"
      rows="3"
      class="border border-line-strong rounded-btn px-3 py-2.5 text-[14px] leading-[1.45] resize-none w-full"
    ></textarea>
    <div class="flex justify-between items-center">
      <span class="text-muted text-[13px]">Sent as SMS to the renter</span>
      <button
        class="bg-accent text-white rounded-btn px-[18px] py-2.5 font-medium cursor-pointer hover:bg-accent-hover"
        @click="sendQuestion"
      >
        Send question
      </button>
    </div>
    <div class="flex items-center gap-3 text-faint text-[12px]">
      <div class="flex-1 h-px bg-line"></div>
      or
      <div class="flex-1 h-px bg-line"></div>
    </div>
    <div class="font-semibold text-ink">Set date manually</div>
    <div class="flex gap-2.5">
      <DateTimePicker v-model="dateValue" />
      <button
        class="border border-line-strong bg-surface rounded-btn px-4 py-2 cursor-pointer hover:bg-canvas"
        @click="checkCalendar"
      >
        Check calendar
      </button>
    </div>
  </div>
</template>
