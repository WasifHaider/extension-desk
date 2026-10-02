<script setup lang="ts">
import type { Badge } from '../types';
import { BADGE_LABEL } from '../copy';

defineProps<{ variant: Badge }>();

const CLASSES: Record<Badge, string> = {
  CLEAN: 'bg-green-bg text-green px-2 py-0.5',
  CONFLICT: 'bg-amber-bg text-amber px-2 py-0.5',
  NEEDS_DATE: 'bg-grey-bg text-grey px-2 py-0.5',
  OFFERED: 'bg-blue-bg text-blue px-2 py-0.5',
  APPROVED: 'bg-surface text-green border border-green px-[7px] py-px',
  DECLINED: 'bg-mute-bg text-mute px-2 py-0.5',
  NOT_EXTENSION: 'bg-mute-bg text-mute px-2 py-0.5',
};
</script>

<template>
  <span class="inline-block rounded-pill text-[12px] font-medium" :class="CLASSES[variant]">
    {{ BADGE_LABEL[variant] }}
  </span>
</template>
