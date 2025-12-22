<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useDataStore } from './stores/data'
import { useCatalogStore } from './stores/catalog'

const auth = useAuthStore()
const data = useDataStore()
const catalog = useCatalogStore()

onMounted(async () => {
  await auth.hydrate()
  if (auth.isAuthed) {
    // keep these light; pages can fetch deeper lists as needed
    await Promise.allSettled([catalog.bootstrap(), data.bootstrap()])
  }
})
</script>

<template>
  <div class="min-h-dvh">
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl animate-floaty"></div>
      <div class="absolute -bottom-24 -left-24 h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl"></div>
      <div class="absolute -top-40 -right-40 h-[640px] w-[640px] rounded-full bg-white/4 blur-3xl"></div>
    </div>

    <RouterView />
  </div>
</template>
