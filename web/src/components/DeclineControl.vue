<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ visible: boolean }>();
const emit = defineEmits<{ decline: [reason: string] }>();

const open = ref(false);
const reason = ref('');

function submit() {
  emit('decline', reason.value.trim());
  open.value = false;
  reason.value = '';
}
</script>

<template>
  <div v-if="visible">
    <button
      class="bg-transparent border-0 p-0 text-muted underline cursor-pointer hover:text-ink"
      @click="open = !open"
    >
      Decline request
    </button>
    <div v-if="open" class="mt-2.5 flex gap-2.5 max-w-[520px]">
      <input
        v-model="reason"
        placeholder="Reason sent to renter (optional)"
        class="flex-1 border border-line-strong rounded-btn px-3 py-2"
      />
      <button
        class="border border-line-strong bg-surface rounded-btn px-4 py-2 cursor-pointer hover:bg-canvas"
        @click="submit"
      >
        Decline
      </button>
    </div>
  </div>
</template>
