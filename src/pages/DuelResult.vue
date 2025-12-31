<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import { toast } from '../utils/toast'

const route = useRoute()
const router = useRouter()
const data = useDataStore()

const code = computed(() => String(route.params.code || '').trim())
const loading = ref(true)
const error = ref('')

const duel = computed(() => data.duel?.duel || null)
const participants = computed(() => data.duel?.participants || [])
const result = computed(() => data.duel?.result || null)

const myUserId = computed(() => String(result.value?.me?.userId || ''))
const isWinner = computed(() => !!myUserId.value && String(result.value?.duel?.winnerUserId || '') === myUserId.value)
const bonusAwarded = computed(() => result.value?.duel?.bonusAwarded === true)
const winnerBonusXp = computed(() => Number(result.value?.duel?.winnerBonusXp || 0))

const rematchBusy = ref(false)

async function rematch() {
  if (rematchBusy.value) return
  const bankId = duel.value?.bankId
  if (!bankId) return

  rematchBusy.value = true
  try {
    const next = await data.createDuel({
      bankId,
      questionCount: Number(duel.value?.questionCount || 10),
      durationMins: Number(duel.value?.durationMins || 10),
    })
    if (next?.code) {
      router.push(`/duel/${next.code}`)
    }
  } catch (e) {
    toast(e?.message || 'Failed to create rematch', 'danger')
  } finally {
    rematchBusy.value = false
  }
}

const winnerName = computed(() => {
  const winId = result.value?.duel?.winnerUserId
  if (!winId) return 'Tie'
  const p = participants.value.find((x) => x.userId === winId)
  return p?.fullName || 'Winner'
})

onMounted(async () => {
  error.value = ''
  loading.value = true
  try {
    await data.getDuelResult(code.value)

    // Winner bonus toast (only once per duel)
    if (isWinner.value && bonusAwarded.value && winnerBonusXp.value > 0) {
      const k = `duel_bonus_toast:${code.value}`
      try {
        if (!localStorage.getItem(k)) {
          toast(`Winner bonus: +${winnerBonusXp.value} XP`, 'ok')
          localStorage.setItem(k, '1')
        }
      } catch (e) {}
    }
  } catch (e) {
    error.value = e?.message || 'Failed to load result'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <AppCard class="max-w-2xl mx-auto">
      <div class="text-xs text-text-3">Duel result</div>
      <div class="h1 mt-1">{{ duel?.bankTitle || '1v1 Duel' }}</div>
      <div class="sub mt-1">Code: <b>{{ code }}</b></div>

      <div v-if="error" class="alert alert-danger mt-4">{{ error }}</div>
      <div v-else-if="loading" class="mt-6 text-sm text-text-3">Loading…</div>
      <div v-else class="mt-6">
        <div class="rounded-xl border border-base-200 p-4">
          <div class="text-sm font-semibold">Winner</div>
          <div class="text-2xl font-bold mt-1">{{ winnerName }}</div>
          <div v-if="winnerName === 'Tie'" class="text-sm text-text-2 mt-1">Same score and time.</div>
        </div>

        <div class="mt-4 rounded-xl border border-base-200 p-4">
          <div class="text-sm font-semibold">Scoreboard</div>
          <div class="mt-3 grid gap-2">
            <div v-for="p in participants" :key="p.userId" class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium">{{ p.fullName }}</div>
                <div class="text-xs text-text-3">{{ p.secondsTotal != null ? p.secondsTotal + 's' : '—' }}</div>
              </div>
              <div class="text-sm font-semibold">{{ p.score != null ? p.score + ' pts' : '—' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap gap-2">
        <AppButton :disabled="rematchBusy" @click="rematch">
          {{ rematchBusy ? 'Creating…' : 'Rematch' }}
        </AppButton>
        <AppButton variant="outline" @click="router.push('/practice')">Back to practice</AppButton>
        <AppButton variant="ghost" @click="router.push(`/duel/${code}`)">Lobby</AppButton>
      </div>
    </AppCard>
  </div>
</template>