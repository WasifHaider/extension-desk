<script setup lang="ts">
import type { ExtensionRequestDetail } from '../types';
import { declinedBannerText } from '../copy';

defineProps<{ detail: ExtensionRequestDetail }>();
</script>

<template>
  <div class="bg-mute-bg text-mute rounded-card px-4 py-3.5 font-medium">
    {{ declinedBannerText(detail) }}
  </div>
</template>
