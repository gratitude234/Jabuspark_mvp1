<script setup>
defineProps({
  pad: { type: Boolean, default: true }
})
</script>

<template>
  <div class="card" :class="pad ? 'card-pad' : ''">
    <slot />
  </div>
</template>
