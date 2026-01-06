<script setup>
defineProps({
  id: { type: String, default: '' },
  name: { type: String, default: '' },
  modelValue: { type: [String, Number, null], default: null },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select…' },
  ariaInvalid: { type: Boolean, default: false },
  ariaDescribedby: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="relative">
    <select
      class="select"
      :id="id || undefined"
      :name="name || undefined"
      :value="modelValue ?? ''"
      :aria-invalid="ariaInvalid || undefined"
      :aria-describedby="ariaDescribedby || undefined"
      :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.value || null)"
    >
      <option value="">{{ placeholder }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-3">▾</div>
  </div>
</template>
