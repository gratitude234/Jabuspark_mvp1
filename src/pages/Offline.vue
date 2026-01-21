<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const online = ref(navigator.onLine)

function setOnline() {
  online.value = true
}
function setOffline() {
  online.value = false
}

const statusText = computed(() => (online.value ? 'Back online ✅' : 'You are offline'))

function go(path) {
  router.push(path)
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
  <div class="min-h-dvh">
    <div class="container-app py-8">
      <div class="page">
        <div class="section">
          <div class="h1">Offline mode</div>
          <p class="sub">{{ statusText }}</p>
        </div>

        <div class="card card-pad space-y-4">
          <div class="text-sm text-text-2">
            What you can do offline depends on what you’ve opened before.
            Previously visited pages and downloaded PDFs should still open.
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <button class="btn btn-ghost" @click="go('/saved')">Open Saved</button>
            <button class="btn btn-ghost" @click="go('/materials')">Browse Materials</button>
            <button class="btn btn-ghost" @click="go('/past-questions')">Past Questions</button>
            <button class="btn btn-ghost" @click="go('/practice')">Dashboard</button>
          </div>

          <div class="divider" />

          <div class="flex flex-wrap gap-2">
            <button class="btn btn-outline btn-sm" @click="location.reload()">Retry</button>
            <button class="btn btn-primary btn-sm" :disabled="!online" @click="go('/practice')">
              Continue online
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
