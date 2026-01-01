<script setup>
import { computed } from 'vue'

const props = defineProps({
  pad: { type: Boolean, default: true },

  /**
   * tone:
   * - "card": main container card (default)
   * - "panel": subtle inner surface (for nested sections)
   * - "flat": almost no border (for header/hero areas if you still want AppCard)
   */
  tone: { type: String, default: 'card' }, // 'card' | 'panel' | 'flat'

  /**
   * press: adds hover/active states for clickable cards (optional)
   */
  press: { type: Boolean, default: false }
})

const cls = computed(() => {
  const base = props.tone === 'panel'
    ? 'panel'
    : props.tone === 'flat'
      ? 'card-flat'
      : 'card'

  return [
    base,
    props.pad ? 'card-pad' : '',
    props.press ? 'card-press' : ''
  ].join(' ')
})
</script>

<template>
  <div :class="cls">
    <slot />
  </div>
</template>
