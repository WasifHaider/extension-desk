<script setup lang="ts">
import { ref } from 'vue';
import type { RenterPickerEntry, Message } from '../types';

const { renters, selectedRenterId, messages } = defineProps<{
  renters: RenterPickerEntry[];
  selectedRenterId: string | null;
  messages: Message[];
}>();
const emit = defineEmits<{ selectRenter: [id: string]; send: [body: string] }>();

const draft = ref('');

function onSelect(e: Event) {
  emit('selectRenter', (e.target as HTMLSelectElement).value);
}

function send() {
  const text = draft.value.trim();
  if (!text) return;
  emit('send', text);
  draft.value = '';
}
</script>

<template>
  <div class="hidden min-[1024px]:flex bg-demo-bg border-l border-dashed border-demo-border p-5 flex-col items-center gap-3.5 h-full overflow-y-auto">
    <div class="self-stretch flex justify-between items-center">
      <b class="font-semibold text-ink">Demo · Renter's phone</b>
      <span class="text-[11px] border border-dashed border-faint text-ink-2 rounded-chip px-1.5 py-0.5">Demo tool, not in product</span>
    </div>
    <div class="w-[290px] h-[640px] bg-ink rounded-[38px] p-3 flex shrink-0">
      <div class="flex-1 bg-surface rounded-[28px] flex flex-col overflow-hidden">
        <div class="px-3.5 pt-3.5 pb-2.5 border-b border-line bg-[#FAFAF9]">
          <div class="text-[11px] text-faint text-center mb-1.5">Text Message · Hudson Drive</div>
          <select
            class="w-full border border-line-strong rounded-btn bg-surface px-2.5 py-1.5 text-[13px]"
            :value="selectedRenterId ?? ''"
            @change="onSelect"
          >
            <option v-for="r in renters" :key="r.id" :value="r.id">{{ r.name }} · {{ r.vehicleName }}</option>
          </select>
        </div>
        <div class="flex-1 p-3.5 flex flex-col gap-2 overflow-y-auto bg-surface">
          <div
            v-for="m in messages"
            :key="m.id"
            class="max-w-[85%] text-[13px] leading-[1.4] px-3 py-2"
            :class="m.direction === 'IN'
              ? 'self-start bg-[#ECECEA] rounded-[16px_16px_16px_4px] text-ink'
              : 'self-end bg-accent text-white rounded-[16px_16px_4px_16px]'"
          >
            {{ m.body }}
          </div>
        </div>
        <div class="p-2.5 border-t border-line flex gap-2">
          <input
            v-model="draft"
            placeholder="Text message"
            class="flex-1 border border-line-strong rounded-pill px-3 py-[7px] text-[13px]"
            @keyup.enter="send"
          />
          <button class="bg-accent text-white rounded-pill px-3.5 text-[13px] font-medium cursor-pointer" @click="send">
            Send
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
