<script setup lang="ts">
import type { ExtensionRequestDetail } from '../types';
import { successBannerText, receiptText } from '../copy';

const { detail, timezone } = defineProps<{ detail: ExtensionRequestDetail; timezone: string }>();
</script>

<template>
  <div>
    <div class="bg-green-bg border border-green-border text-green rounded-card px-4 py-3.5 font-medium flex items-center gap-2.5">
      <span class="w-5 h-5 rounded-full bg-green text-white text-[12px] grid place-items-center">✓</span>
      <span class="tabular-nums">{{ successBannerText(detail, timezone) }}</span>
    </div>
    <div v-if="detail.receipt" class="mt-2 text-ink-2 tabular-nums">{{ receiptText(detail) }}</div>
  </div>
</template>
