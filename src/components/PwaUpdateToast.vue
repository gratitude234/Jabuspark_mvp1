<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const show = ref(false)
let registration = null

function onUpdate(e) {
  registration = e?.detail?.registration || null
  show.value = true
}

async function applyUpdate() {
  try {
    // Many Workbox-based SWs listen for SKIP_WAITING.
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  } catch (_) {
    // ignore
  }
  // If SKIP_WAITING isn't supported, a reload still helps pick up new assets in many setups.
  window.location.reload()
}

onMounted(() => window.addEventListener('pwa:update', onUpdate))
onBeforeUnmount(() => window.removeEventListener('pwa:update', onUpdate))
</script>

<template>
  <div v-if="show" class="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl">
    <div class="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur">
      <div class="text-sm text-white/90">
        A new version is available.
      </div>
      <button
        class="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black"
        @click="applyUpdate"
      >
        Update
      </button>
    </div>
  </div>
</template>
