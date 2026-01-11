<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  label: { type: String, default: '' },
})

const pct = computed(() => {
  const n = Number(props.value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
})
</script>

<template>
  <div
    class="w-full"
    role="progressbar"
    :aria-label="label || 'Progress'"
    :aria-valuenow="pct"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="h-2 w-full rounded-full bg-white/10">
      <div
        class="h-2 rounded-full bg-accent transition-[width] duration-300"
        :style="{ width: pct + '%' }"
      />
    </div>
  </div>
</template>
