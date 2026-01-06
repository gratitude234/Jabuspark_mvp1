<script setup>
import { computed, onMounted, ref } from 'vue'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'

const data = useDataStore()
const claiming = ref('')

const weekStart = computed(() => data.missions?.weekStart || '')
const weekEnd = computed(() => {
  if (!weekStart.value) return ''
  try {
    const d = new Date(weekStart.value + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 6)
    return d.toISOString().slice(0, 10)
  } catch (e) {
    return ''
  }
})

const items = computed(() => data.missions?.items || [])
const claimable = computed(() => Number(data.missions?.claimable || 0))
const streakFreezes = computed(() => Number(data.progress?.streakFreezes || 0))

const pct = (m) => {
  const t = Number(m?.target || 0)
  const p = Number(m?.progress || 0)
  if (!t) return 0
  return Math.max(0, Math.min(100, Math.round((p / t) * 100)))
}

async function claim(m) {
  if (!m?.missionKey || claiming.value) return
  claiming.value = m.missionKey
  try {
    await data.claimMission(m.missionKey)
  } finally {
    claiming.value = ''
  }
}

onMounted(async () => {
  try {
    await data.fetchMissions()
  } catch (e) {
    // optional feature: ignore
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-text">Weekly Missions</h1>
        <p class="text-text-2 text-sm" v-if="weekStart">
          Week: <span class="font-mono">{{ weekStart }}</span>
          <span v-if="weekEnd"> → <span class="font-mono">{{ weekEnd }}</span></span>
        </p>
        <p class="text-text-2 text-sm" v-else>
          Complete missions to earn rewards.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span class="chip">Claimable: <b class="ml-1">{{ claimable }}</b></span>
        <span class="chip">Streak Freeze: <b class="ml-1">{{ streakFreezes }}</b></span>
      </div>
    </div>

    <AppCard>
      <template #title>How it works</template>
      <div class="text-sm text-text-2 leading-relaxed">
        Missions reset every week (Monday → Sunday). When you complete one, claim your reward.
        <span class="text-text">Streak Freeze</span> saves your streak if you miss exactly one day.
      </div>
    </AppCard>

    <div class="grid gap-3">
      <AppCard v-for="m in items" :key="m.missionKey">
        <template #title>
          <div class="flex items-center justify-between gap-2">
            <span>{{ m.title }}</span>
            <span v-if="m.isClaimed" class="chip">Claimed</span>
            <span v-else-if="m.isComplete" class="chip">Complete</span>
          </div>
        </template>

        <div class="space-y-3">
          <div class="text-sm text-text-2">{{ m.description }}</div>

          <div class="flex items-center justify-between text-sm">
            <div class="text-text">
              <span class="font-mono">{{ m.progress }}</span> / <span class="font-mono">{{ m.target }}</span>
            </div>
            <div class="text-text-2">
              Reward:
              <span class="text-text">+{{ m.rewardXp || 0 }} XP</span>
              <span v-if="m.rewardFreezes" class="text-text"> • +{{ m.rewardFreezes }} Freeze</span>
            </div>
          </div>

          <div class="h-2 rounded-full bg-white/5 overflow-hidden">
            <div class="h-2 bg-accent" :style="{ width: pct(m) + '%' }" />
          </div>

          <div class="flex items-center justify-end">
            <button
              class="btn btn-primary btn-sm"
              :disabled="!m.isComplete || m.isClaimed || claiming"
              @click="claim(m)"
            >
              <span v-if="claiming === m.missionKey">Claiming…</span>
              <span v-else>Claim</span>
            </button>
          </div>
        </div>
      </AppCard>

      <AppCard v-if="!items.length">
        <template #title>Missions unavailable</template>
        <div class="text-sm text-text-2">
          If you just deployed the backend, run the migration:
          <span class="font-mono">api/migrations/2025_12_30_weekly_missions.sql</span>
        </div>
      </AppCard>
    </div>
  </div>
</template>
