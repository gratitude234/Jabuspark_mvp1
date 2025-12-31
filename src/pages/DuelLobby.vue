<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import { toast } from '../utils/toast'

const route = useRoute()
const router = useRouter()
const data = useDataStore()

const code = computed(() => String(route.params.code || '').trim())
const busy = ref(false)
const error = ref('')

const duel = computed(() => data.duel?.duel || null)
const participants = computed(() => data.duel?.participants || [])

const shareUrl = computed(() => {
  try {
    const origin = window.location.origin
    return `${origin}/duel/${code.value}`
  } catch (e) {
    return `/duel/${code.value}`
  }
})

const statusLabel = computed(() => {
  const s = duel.value?.status || 'waiting'
  if (s === 'live') return 'Live'
  if (s === 'completed') return 'Completed'
  return 'Waiting'
})

let poll = null

async function refresh() {
  error.value = ''
  if (!code.value) return
  try {
    await data.getDuel(code.value)
  } catch (e) {
    error.value = e?.message || 'Failed to load duel'
  }
}

async function joinOrStart() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await data.startDuel(code.value)
    const qs = res?.questions || []
    if ((res?.duel?.status === 'live') && qs.length) {
      router.push(`/duel/${code.value}/take`)
    } else if (res?.duel?.status === 'completed') {
      router.push(`/duel/${code.value}/result`)
    }
  } catch (e) {
    error.value = e?.message || 'Could not join duel'
  } finally {
    busy.value = false
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    toast('Link copied', 'ok')
  } catch (e) {
    toast('Copy failed. Long press to copy.', 'warn')
  }
}

function startPolling() {
  stopPolling()
  poll = setInterval(async () => {
    // Prefer calling start (it will flip to live once 2nd player joins)
    try {
      const res = await data.startDuel(code.value)
      if (res?.duel?.status === 'live' && (res?.questions || []).length) {
        stopPolling()
        router.push(`/duel/${code.value}/take`)
      } else if (res?.duel?.status === 'completed') {
        stopPolling()
        router.push(`/duel/${code.value}/result`)
      }
    } catch (e) {
      // ignore polling errors
    }
  }, 4000)
}

function stopPolling() {
  if (poll) clearInterval(poll)
  poll = null
}

onMounted(async () => {
  await refresh()
  // If I'm not yet a participant and there's room, this will join me.
  await joinOrStart()
  // Keep checking for opponent (unless already completed)
  if (duel.value?.status !== 'completed') startPolling()
})

onBeforeUnmount(() => stopPolling())
</script>

<template>
  <div class="page">
    <AppCard class="max-w-2xl mx-auto">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xs text-text-3">1v1 Duel</div>
          <div class="h1 mt-1">{{ duel?.bankTitle || 'Practice Duel' }}</div>
          <div class="sub mt-1">Code: <b>{{ code }}</b> • <span class="badge">{{ statusLabel }}</span></div>
        </div>

        <AppButton variant="ghost" size="sm" @click="copyLink">Copy link</AppButton>
      </div>

      <div v-if="error" class="alert alert-danger mt-4">{{ error }}</div>

      <div class="mt-6 grid gap-3">
        <div class="rounded-xl border border-base-200 p-4">
          <div class="text-sm font-semibold">Players</div>
          <div class="mt-3 grid gap-2">
            <div v-for="p in participants" :key="p.userId" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="h-8 w-8 rounded-full bg-base-200 flex items-center justify-center text-sm font-semibold">
                  {{ (p.fullName || '?').slice(0, 1).toUpperCase() }}
                </div>
                <div>
                  <div class="text-sm font-medium">{{ p.fullName || 'Unknown' }}</div>
                  <div class="text-xs text-text-3">{{ p.submittedAt ? 'Submitted' : 'Not submitted yet' }}</div>
                </div>
              </div>
              <div class="text-sm">
                <span v-if="p.score !== null">{{ p.score }} pts</span>
                <span v-else class="text-text-3">—</span>
              </div>
            </div>

            <div v-if="participants.length < 2" class="text-sm text-text-3">
              Waiting for an opponent… share the link.
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-base-200 p-4">
          <div class="text-sm font-semibold">How it works</div>
          <ul class="mt-2 list-disc pl-5 text-sm text-text-2 space-y-1">
            <li>Both players answer the same questions.</li>
            <li>Winner = highest score (tie-breaker: faster time).</li>
            <li>Duel starts automatically once 2nd player joins.</li>
          </ul>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap gap-2">
        <AppButton :disabled="busy" @click="joinOrStart">Refresh / Join</AppButton>
        <AppButton
          variant="outline"
          :disabled="(duel?.status !== 'live')"
          @click="router.push(`/duel/${code}/take`)"
        >
          Start duel
        </AppButton>
        <AppButton
          v-if="duel?.status === 'completed'"
          variant="ghost"
          @click="router.push(`/duel/${code}/result`)"
        >
          View result
        </AppButton>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
.badge{
  display:inline-flex;
  align-items:center;
  gap:.25rem;
  padding:2px 8px;
  border-radius:999px;
  background:rgba(0,0,0,.06);
}
</style>
