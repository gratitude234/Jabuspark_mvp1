<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'primary' }, // primary | ghost | danger
  size: { type: String, default: 'md' }, // sm | md | lg
  as: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
})

const variantClass = computed(() => {
  if (props.variant === 'danger') return 'btn-danger'
  if (props.variant === 'ghost') return 'btn-ghost'
  return 'btn-primary'
})

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'btn-sm'
  if (props.size === 'lg') return 'btn-lg'
  return ''
})
</script>

<template>
  <component
    :is="as"
    class="btn"
    :class="[variantClass, sizeClass]"
    :disabled="disabled"
    :type="as === 'button' ? type : undefined"
  >
    <slot />
  </component>
</template>
