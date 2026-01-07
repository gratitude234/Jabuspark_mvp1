<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isOnline = computed(() => navigator.onLine)

function retry() {
  window.location.reload()
}
</script>

<template>
  <div class="min-h-dvh px-4 py-10">
    <div class="mx-auto max-w-xl">
      <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 class="text-2xl font-bold text-white">Offline mode</h1>
        <p class="mt-2 text-white/70">
          You can still open pages you visited recently (and any cached PDFs/materials).
        </p>

        <div class="mt-5 flex flex-wrap gap-2">
          <button
            class="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
            @click="retry"
          >
            Retry
          </button>
          <button
            class="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90"
            @click="router.push('/saved')"
          >
            Saved
          </button>
          <button
            class="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90"
            @click="router.push('/materials')"
          >
            Materials
          </button>
          <button
            class="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90"
            @click="router.push('/past-questions')"
          >
            Past Questions
          </button>
        </div>

        <div class="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
          <div class="font-semibold text-white/90">Tip</div>
          Open a material (PDF) once while online—then it will stay available offline if cached.
        </div>

        <div class="mt-4 text-sm">
          <span class="text-white/70">Network:</span>
          <span class="ml-2 font-semibold" :class="isOnline ? 'text-emerald-300' : 'text-amber-300'">
            {{ isOnline ? 'Online' : 'Offline' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
