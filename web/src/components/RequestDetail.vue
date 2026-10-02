<script setup lang="ts">
import type { ExtensionRequestDetail, EngineOption } from '../types';
import { formatDateTime } from '../format';
import ChatBubble from './ChatBubble.vue';
import InterpretationLine from './InterpretationLine.vue';
import SuccessBanner from './SuccessBanner.vue';
import DeclinedBanner from './DeclinedBanner.vue';
import Timeline from './Timeline.vue';
import NeedsDateCard from './NeedsDateCard.vue';
import OptionCard from './OptionCard.vue';
import DeclineControl from './DeclineControl.vue';
import EventLog from './EventLog.vue';

const { detail, timezone } = defineProps<{ detail: ExtensionRequestDetail; timezone: string }>();
const emit = defineEmits<{
  edit: [];
  act: [type: EngineOption['type']];
  decline: [reason: string];
  sendQuestion: [text: string];
  setDate: [iso: string];
}>();

const dueEnd = () => (detail.status === 'APPROVED' && detail.chosenEndAt ? detail.chosenEndAt : detail.currentEndAt);
const showTimeline = () => detail.status !== 'NEEDS_DATE' && detail.status !== 'NOT_EXTENSION';
const showOptionCards = () => detail.status === 'READY' || detail.status === 'OFFERED';
const showDecline = () => !['APPROVED', 'DECLINED', 'NOT_EXTENSION'].includes(detail.status);
</script>

<template>
  <div class="p-9 flex flex-col gap-5 min-w-0 h-full overflow-y-auto">
    <div>
      <div class="flex items-center gap-2.5">
        <div class="text-[22px] font-semibold text-ink">{{ detail.renter?.name ?? 'Turo guest' }}</div>
        <span v-if="detail.hasCover" class="text-[12px] bg-grey-bg text-ink-2 rounded-chip px-2 py-0.5">Damage cover</span>
      </div>
      <div class="text-muted mt-1">
        {{ detail.vehicle.name }} ·
        <span class="text-ink font-medium tabular-nums">Due back {{ formatDateTime(dueEnd(), timezone) }}</span>
        <span v-if="detail.status === 'APPROVED'" class="text-faint tabular-nums"> · was {{ formatDateTime(detail.originalEndAt, timezone) }}</span>
      </div>
    </div>

    <ChatBubble :body="detail.message.body" :created-at="detail.message.createdAt" :timezone="timezone" />

    <SuccessBanner v-if="detail.status === 'APPROVED'" :detail="detail" :timezone="timezone" />
    <DeclinedBanner v-else-if="detail.status === 'DECLINED'" :detail="detail" />
    <InterpretationLine
      v-else-if="detail.status !== 'NEEDS_DATE' && detail.status !== 'NOT_EXTENSION'"
      :detail="detail"
      :timezone="timezone"
      @edit="emit('edit')"
    />

    <Timeline v-if="showTimeline()" :detail="detail" :timezone="timezone" />

    <NeedsDateCard
      v-if="detail.status === 'NEEDS_DATE'"
      :draft="detail.clarifyingQuestionDraft ?? ''"
      :timezone="timezone"
      @send-question="(text) => emit('sendQuestion', text)"
      @set-date="(iso) => emit('setDate', iso)"
    />

    <div v-if="showOptionCards()" class="flex flex-col gap-3">
      <OptionCard
        v-for="(o, i) in detail.options"
        :key="'opt-' + i"
        :option="o"
        :detail="detail"
        :timezone="timezone"
        @act="(type) => emit('act', type)"
      />
      <OptionCard
        v-for="(u, i) in detail.unavailable.filter((x) => x.type === 'FULL' || x.type === 'REASSIGN_NEXT')"
        :key="'unavail-' + i"
        :unavailable="u"
        :detail="detail"
        :timezone="timezone"
      />
    </div>
    <DeclineControl :visible="showDecline()" @decline="(reason) => emit('decline', reason)" />

    <EventLog :events="detail.events" :timezone="timezone" />
  </div>
</template>
