<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const offline = ref(!navigator.onLine)

function setOffline() { offline.value = true }
function setOnline() { offline.value = false }

function goOfflinePage() {
  router.push('/offline')
}

onMounted(() => {
  window.addEventListener('pwa:offline', setOffline)
  window.addEventListener('pwa:online', setOnline)
  window.addEventListener('offline', setOffline)
  window.addEventListener('online', setOnline)
})

onBeforeUnmount(() => {
  window.removeEventListener('pwa:offline', setOffline)
  window.removeEventListener('pwa:online', setOnline)
  window.removeEventListener('offline', setOffline)
  window.removeEventListener('online', setOnline)
})
</script>

<template>
  <div v-if="offline" class="fixed top-0 left-0 right-0 z-50">
    <button
      class="w-full border-b border-white/10 bg-black/70 px-4 py-2 text-center text-sm text-white/90 backdrop-blur"
      @click="goOfflinePage"
    >
      You’re offline. Tap to open offline mode.
    </button>
  </div>
</template>
