<script setup>
import { ref } from 'vue'

const toasts = ref([])

function push(message, tone = 'ok') {
  const id = crypto.randomUUID()
  toasts.value.unshift({ id, message, tone })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, 2600)
}

defineExpose({ push })
</script>

<template>
  <div
    class="fixed right-4 z-50 w-[min(360px,calc(100vw-2rem))] space-y-2"
    :style="{ top: 'calc(16px + env(safe-area-inset-top))' }"
    aria-live="polite"
    aria-relevant="additions"
  >
    <TransitionGroup name="toast" tag="div" class="space-y-2">
      <div v-for="t in toasts" :key="t.id" class="card card-pad">
        <div
          class="text-sm font-semibold"
          :class="t.tone === 'danger' ? 'text-danger' : t.tone === 'warn' ? 'text-warn' : 'text-text'"
        >
          {{ t.message }}
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
