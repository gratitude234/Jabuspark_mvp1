<script setup>
import { computed, onMounted, ref } from 'vue'
import { useDataStore } from '../stores/data'
import { toast } from '../utils/toast'
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

// Be defensive: some backend deployments don't send isComplete/isClaimed consistently.
// We derive these fields from progress/target and claimedAt so the "Claim" button
// remains clickable and we can surface useful feedback instead of feeling "dead".
const missionKeyOf = (m) => m?.missionKey || m?.mission_key || m?.key || m?.id || ''
const isClaimed = (m) => Boolean(m?.isClaimed ?? m?.is_claimed ?? m?.claimedAt ?? m?.claimed_at)
const isComplete = (m) => {
  if (Boolean(m?.isComplete ?? m?.is_complete)) return true
  const t = Number(m?.target ?? m?.goal ?? 0)
  const p = Number(m?.progress ?? m?.current ?? 0)
  return t > 0 && p >= t
}

const pct = (m) => {
  const t = Number(m?.target || 0)
  const p = Number(m?.progress || 0)
  if (!t) return 0
  return Math.max(0, Math.min(100, Math.round((p / t) * 100)))
}

async function claim(m) {
  const key = missionKeyOf(m)
  if (!key || claiming.value) {
    if (!key) toast('This mission cannot be claimed (missing mission key).', 'err')
    return
  }

  if (isClaimed(m)) {
    toast('You already claimed this mission.', 'ok')
    return
  }

  if (!isComplete(m)) {
    toast('Finish this mission first, then claim your reward.', 'err')
    return
  }

  claiming.value = key
  try {
    await data.claimMission(key)
  } catch (e) {
    // Surface server errors (otherwise it feels like the button is "unclaimable")
    toast(e?.message || 'Failed to claim mission.', 'err')
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
      <AppCard v-for="m in items" :key="missionKeyOf(m) || m.title">
        <template #title>
          <div class="flex items-center justify-between gap-2">
            <span>{{ m.title }}</span>

            <span
              v-if="isClaimed(m)"
              class="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-text"
              title="Reward claimed"
            >
              Claimed
            </span>
            <span
              v-else-if="isComplete(m)"
              class="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-text-2"
              title="Ready to claim"
            >
              Complete
            </span>
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
              :disabled="Boolean(claiming) || isClaimed(m) || !isComplete(m)"
              @click="claim(m)"
              :title="isClaimed(m) ? 'Already claimed' : (!isComplete(m) ? 'Complete the mission to claim' : 'Claim reward')"
            >
              <span v-if="claiming === missionKeyOf(m)">Claiming…</span>
              <span v-else-if="isClaimed(m)">Claimed</span>
              <span v-else-if="!isComplete(m)">Not ready</span>
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
