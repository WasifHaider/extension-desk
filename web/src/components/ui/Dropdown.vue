<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

export interface DropdownOption {
  value: string;
  label: string;
}

const { modelValue, options, placeholder = 'Select…', disabled = false } = defineProps<{
  modelValue: string;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);

const selected = computed(() => options.find((o) => o.value === modelValue) ?? null);

function toggle() {
  if (disabled) return;
  open.value = !open.value;
  if (open.value) {
    nextTick(() => panel.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
}

function choose(value: string) {
  emit('update:modelValue', value);
  open.value = false;
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="root" class="relative inline-block w-full">
    <button
      type="button"
      class="btn w-full flex items-center justify-between gap-2 bg-surface border border-line-strong rounded-btn px-2.5 py-1.5 text-left disabled:opacity-50 disabled:cursor-not-allowed"
      :class="open ? 'border-accent shadow-[0_0_0_3px_var(--color-accent-tint)]' : 'hover:border-faint'"
      :disabled="disabled"
      @click="toggle"
    >
      <span class="truncate" :class="selected ? 'text-ink' : 'text-faint'">{{ selected?.label ?? placeholder }}</span>
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        class="shrink-0 transition-transform duration-150"
        :class="open ? '-rotate-180' : ''"
      >
        <path d="M1 1l4 4 4-4" stroke="#6B6B66" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Transition name="fade">
      <div
        v-if="open"
        ref="panel"
        class="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-surface border border-line rounded-card shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1"
      >
        <button
          v-for="o in options"
          :key="o.value"
          type="button"
          class="w-full text-left px-3 py-1.5 text-[13px] cursor-pointer transition-ui"
          :class="o.value === modelValue ? 'bg-accent-tint text-accent font-medium' : 'text-ink hover:bg-canvas'"
          @click="choose(o.value)"
        >
          {{ o.label }}
        </button>
        <div v-if="options.length === 0" class="px-3 py-1.5 text-[13px] text-faint">No options</div>
      </div>
    </Transition>
  </div>
</template>
