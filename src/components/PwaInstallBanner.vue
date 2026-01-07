<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const deferredPrompt = ref(null)
const dismissed = ref(false)

const isStandalone = computed(() => {
  // display-mode: standalone OR iOS standalone flag
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true
})

const isIOS = computed(() => {
  const ua = window.navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream
})

const show = computed(() => {
  if (isStandalone.value) return false
  if (dismissed.value) return false
  // show if we have a deferred prompt OR iOS (manual install)
  return Boolean(deferredPrompt.value) || isIOS.value
})

function dismiss() {
  dismissed.value = true
  try {
    localStorage.setItem('pwa_install_dismissed', '1')
  } catch (_) {}
}

async function install() {
  const promptEvent = deferredPrompt.value
  if (!promptEvent) return
  promptEvent.prompt()
  const res = await promptEvent.userChoice
  // Clear the saved prompt since it can't be used twice
  deferredPrompt.value = null
  if (res?.outcome === 'accepted') dismiss()
}

function onBeforeInstallPrompt(e) {
  // stop Chrome from showing its mini-infobar
  e.preventDefault()
  deferredPrompt.value = e
}

onMounted(() => {
  dismissed.value = localStorage.getItem('pwa_install_dismissed') === '1'
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})
</script>

<template>
  <div
    v-if="show"
    class="fixed left-4 right-4 z-40 mx-auto w-[min(560px,calc(100vw-2rem))]"
    :style="{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }"
  >
    <div class="card card-pad flex items-start justify-between gap-3">
      <div class="space-y-1">
        <div class="text-sm font-semibold">Install JabuStudyHub</div>
        <div v-if="deferredPrompt" class="text-xs text-text-3">
          Get faster loads and offline access. Add it to your home screen.
        </div>
        <div v-else class="text-xs text-text-3">
          On iPhone: tap <span class="font-semibold text-text">Share</span> → <span class="font-semibold text-text">Add to Home Screen</span>.
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button class="btn btn-outline btn-sm" @click="dismiss">Not now</button>
        <button v-if="deferredPrompt" class="btn btn-primary btn-sm" @click="install">Install</button>
      </div>
    </div>
  </div>
</template>
