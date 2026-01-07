<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const show = ref(false)

function onNeedRefresh() {
  show.value = true
}

function updateNow() {
  try {
    // triggers skipWaiting + reload handled by plugin
    window.__PWA_UPDATE__?.()
  } finally {
    // keep it visible until reload; if reload fails, allow close
    setTimeout(() => (show.value = false), 3000)
  }
}

function dismiss() {
  show.value = false
}

onMounted(() => {
  window.addEventListener('pwa:need-refresh', onNeedRefresh)
})

onBeforeUnmount(() => {
  window.removeEventListener('pwa:need-refresh', onNeedRefresh)
})
</script>

<template>
  <div
    v-if="show"
    class="fixed bottom-4 left-4 right-4 z-50 mx-auto w-[min(520px,calc(100vw-2rem))]"
  >
    <div class="card card-pad flex items-center justify-between gap-3">
      <div>
        <div class="text-sm font-semibold">Update available</div>
        <div class="text-xs text-text-3">A new version of JabuStudyHub is ready.</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-outline btn-sm" @click="dismiss">Later</button>
        <button class="btn btn-primary btn-sm" @click="updateNow">Update</button>
      </div>
    </div>
  </div>
</template>
