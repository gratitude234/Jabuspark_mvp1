<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const deferredPrompt = ref(null)
const dismissed = ref(false)
const installed = ref(false)

// iOS doesn't support beforeinstallprompt; show instructions instead.
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true

const canShow = computed(() => !dismissed.value && !installed.value && !isStandalone)

function onBeforeInstallPrompt(e) {
  e.preventDefault()
  deferredPrompt.value = e
}

function onAppInstalled() {
  installed.value = true
  deferredPrompt.value = null
}

async function install() {
  if (!deferredPrompt.value) return
  deferredPrompt.value.prompt()
  try {
    await deferredPrompt.value.userChoice
  } finally {
    deferredPrompt.value = null
  }
}

function dismiss() {
  dismissed.value = true
  // keep it quiet for this session (you can persist in localStorage if you want)
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.removeEventListener('appinstalled', onAppInstalled)
})
</script>

<template>
  <div v-if="canShow" class="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl">
    <div class="rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur">
      <div class="flex items-start justify-between gap-3">
        <div class="text-sm text-white/90">
          <div class="font-semibold text-white">Install JabuStudyHub</div>
          <div class="mt-1 text-white/70">
            Get faster loads and offline access to recently opened content.
          </div>
          <div v-if="isIOS" class="mt-2 text-white/70">
            On iPhone/iPad: tap <span class="font-semibold">Share</span> → <span class="font-semibold">Add to Home Screen</span>.
          </div>
        </div>

        <button class="text-white/70 hover:text-white" @click="dismiss" aria-label="Dismiss">
          ✕
        </button>
      </div>

      <div class="mt-3 flex items-center gap-2">
        <button
          v-if="!isIOS && deferredPrompt"
          class="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black"
          @click="install"
        >
          Install
        </button>
        <button
          class="rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-white/90"
          @click="dismiss"
        >
          Not now
        </button>
      </div>
    </div>
  </div>
</template>
