<script setup>
defineProps({
  id: { type: String, default: '' },
  name: { type: String, default: '' },
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: '' },
  inputmode: { type: String, default: '' },
  ariaInvalid: { type: Boolean, default: false },
  ariaDescribedby: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <input
    class="input"
    :id="id || undefined"
    :name="name || undefined"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :autocomplete="autocomplete || undefined"
    :inputmode="inputmode || undefined"
    :aria-invalid="ariaInvalid || undefined"
    :aria-describedby="ariaDescribedby || undefined"
    :disabled="disabled"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>
