<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isOffline = ref(!navigator.onLine)

function setOnline() {
  isOffline.value = false
}
function setOffline() {
  isOffline.value = true
}

function openOffline() {
  router.push('/offline')
}

onMounted(() => {
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOffline)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', setOnline)
  window.removeEventListener('offline', setOffline)
})
</script>

<template>
  <div
    v-if="isOffline"
    class="fixed left-4 right-4 z-40 mx-auto w-[min(560px,calc(100vw-2rem))]"
    :style="{ top: 'calc(12px + env(safe-area-inset-top))' }"
  >
    <div class="alert alert-warn flex items-center justify-between gap-3">
      <div class="text-sm font-semibold">You’re offline</div>
      <button class="btn btn-outline btn-sm" @click="openOffline">Offline mode</button>
    </div>
  </div>
</template>
