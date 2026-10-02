<script setup lang="ts">
import type { EngineOption, UnavailableOption, ExtensionRequestDetail } from '../types';
import { formatMoney } from '../format';
import { optionTitle, optionButton, optionNote, unavailableTitle, askText } from '../copy';

const props = defineProps<{
  option?: EngineOption;
  unavailable?: UnavailableOption;
  detail: ExtensionRequestDetail;
  timezone: string;
}>();
const emit = defineEmits<{ act: [type: EngineOption['type']] }>();

const available = !!props.option;
</script>

<template>
  <div
    class="rounded-card p-4"
    :class="available ? 'bg-surface border border-line' : 'bg-[#FAFAF9] border border-line opacity-75'"
  >
    <template v-if="option">
      <div class="flex justify-between gap-4 items-baseline">
        <div class="text-[15px] font-semibold text-ink">{{ optionTitle(option, detail, timezone) }}</div>
        <div class="tabular-nums text-muted whitespace-nowrap">{{ askText(detail, timezone) }}</div>
      </div>
      <div v-if="option.quote" class="mt-3 flex flex-col gap-1 tabular-nums max-w-[420px]">
        <div
          v-for="(line, i) in option.quote.lineItems.filter((l) => l.label !== 'Total')"
          :key="i"
          class="flex justify-between text-ink-2"
        >
          <span>{{ line.label }}</span>
          <span>{{ formatMoney(line.amountCents) }}</span>
        </div>
        <div class="flex justify-between border-t border-line pt-1.5 mt-0.5 font-semibold text-ink">
          <span>Total</span>
          <span>{{ formatMoney(option.quote.totalCents) }}</span>
        </div>
      </div>
      <div class="mt-3.5 flex items-center gap-3.5 flex-wrap">
        <button
          class="bg-accent text-white rounded-btn px-5 py-2.5 font-medium cursor-pointer hover:bg-accent-hover"
          @click="emit('act', option.type)"
        >
          {{ optionButton(option, detail.status) }}
        </button>
        <span class="text-muted text-[13px]">{{ optionNote(option, detail, detail.status) }}</span>
      </div>
    </template>
    <template v-else-if="unavailable">
      <div class="font-semibold text-[14px] line-through text-faint">
        {{ unavailableTitle(unavailable.type as 'FULL' | 'REASSIGN_NEXT', detail, timezone) }}
      </div>
      <div class="mt-1 text-ink-2 text-[13px]">{{ unavailable.reason }}</div>
    </template>
  </div>
</template>
