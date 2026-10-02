<script setup lang="ts">
import { DateTime } from 'luxon';

const { body, createdAt, timezone } = defineProps<{ body: string; createdAt: string; timezone: string }>();

function metaLine(): string {
  const dt = DateTime.fromISO(createdAt, { zone: 'utc' }).setZone(timezone);
  const now = DateTime.now().setZone(timezone);
  const day = dt.hasSame(now, 'day') ? 'Today' : dt.toFormat('ccc d MMM');
  return `${day}, ${dt.toFormat('h:mm a')} · via SMS`;
}
</script>

<template>
  <div class="self-start max-w-[520px]">
    <div class="bg-surface border border-line rounded-[4px_16px_16px_16px] px-4 py-3 text-[15px] leading-[1.45] text-ink">
      {{ body }}
    </div>
    <div class="text-faint text-[12px] mt-[5px] ml-1 tabular-nums">{{ metaLine() }}</div>
  </div>
</template>
