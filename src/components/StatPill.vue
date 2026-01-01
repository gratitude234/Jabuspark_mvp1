<script setup>
defineProps({
  label: String,
  value: [String, Number],
  hint: { type: String, default: '' }
})
</script>

<template>
  <div class="tile p-3 sm:p-4">
    <div class="text-[11px] sm:text-xs font-semibold tracking-wide text-text-3 uppercase">
      {{ label }}
    </div>

    <div class="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
      {{ value }}
    </div>

    <div v-if="hint" class="mt-1 text-xs text-text-2">
      {{ hint }}
    </div>
  </div>
</template>
