<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '../stores/data'
import { storage } from '../utils/storage'
import AppCard from '../components/AppCard.vue'

const route = useRoute()
const router = useRouter()
const data = useDataStore()

const challengeId = computed(() => String(route.params.challengeId || ''))

const loading = ref(false)
const error = ref('')
const res = ref(null)
const scoreboard = ref([])

function fmtTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    // try store / cache
    const key = `challenge_result:${challengeId.value}`
    res.value = data.groups?.result?.challengeId === challengeId.value
      ? data.groups.result
      : (storage.get(key, null))

    // scoreboard always available
    scoreboard.value = await data.getChallengeScoreboard(challengeId.value)
    if (!res.value) {
      // still show scoreboard even if result isn't cached
      res.value = null
    }
  } catch (e) {
    error.value = e?.message || 'Failed to load result'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const score = computed(() => Number(res.value?.scorePercent || 0))
const total = computed(() => Number(res.value?.total || 0))
const correct = computed(() => Number(res.value?.correct || 0))
const wrongList = computed(() => res.value?.reviewWrong || [])

function backToGroup() {
  const gid = res.value?.groupId || data.groups?.challenge?.challenge?.groupId || ''
  router.push(gid ? `/groups/${gid}` : '/groups')
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="h1">Challenge Result</div>
          <p class="sub mt-1">Compare your score with your group.</p>
        </div>
        <div class="text-right">
          <div class="text-xs text-text-3">Score</div>
          <div class="text-3xl font-extrabold">{{ score }}%</div>
        </div>
      </div>

      <div v-if="error" class="alert alert-warn mt-4" role="alert">{{ error }}</div>

      <div v-if="loading" class="mt-4 grid gap-2">
        <div class="skeleton h-20" />
        <div class="skeleton h-20" />
      </div>

      <div v-else class="mt-4">
        <div v-if="res" class="grid grid-cols-3 gap-2 text-center">
          <div class="chip">
            <div class="text-xs text-text-3">Correct</div>
            <div class="text-base font-extrabold">{{ correct }} / {{ total }}</div>
          </div>
          <div class="chip">
            <div class="text-xs text-text-3">Wrong</div>
            <div class="text-base font-extrabold">{{ total - correct }}</div>
          </div>
          <div class="chip">
            <div class="text-xs text-text-3">Time</div>
            <div class="text-base font-extrabold">{{ fmtTime(res.secondsTotal) }}</div>
          </div>
        </div>

        <div class="mt-4 flex flex-col sm:flex-row gap-2">
          <RouterLink to="/practice/review" class="btn btn-primary">Smart Review</RouterLink>
          <button class="btn btn-ghost" type="button" @click="backToGroup">Back to group</button>
        </div>

        <div class="mt-6">
          <div class="h2">Scoreboard</div>
          <p class="sub mt-1">Top scores ranked by score, then time.</p>

          <div class="mt-3 grid gap-2">
            <div v-for="(s, idx) in scoreboard" :key="s.userId" class="card card-pad">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-extrabold truncate">
                    #{{ idx + 1 }} • {{ s.fullName }}
                    <span v-if="s.isMe" class="badge ml-2">You</span>
                  </div>
                  <div class="text-xs text-text-3 mt-1">{{ s.correct }} / {{ s.total }} • {{ fmtTime(s.secondsTotal) }}</div>
                </div>
                <div class="text-right">
                  <div class="text-xs text-text-3">Score</div>
                  <div class="text-lg font-extrabold">{{ s.scorePercent }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="res" class="mt-6">
          <div class="h2">Mistakes to fix</div>
          <p class="sub mt-1" v-if="!wrongList.length">Perfect! No wrong answers.</p>

          <div v-else class="mt-3 grid gap-2">
            <div v-for="(w, idx) in wrongList" :key="w.questionId" class="card card-pad">
              <div class="text-sm font-extrabold">{{ idx + 1 }}. {{ w.prompt }}</div>
              <div class="mt-2 grid gap-1 text-sm">
                <div v-for="(opt, i) in w.options" :key="i" class="text-text-2">
                  <span class="font-semibold">{{ String.fromCharCode(65 + i) }}.</span>
                  {{ opt }}
                  <span v-if="i === w.answerIndex" class="badge ml-2">Correct</span>
                  <span v-else-if="i === w.selectedIndex" class="badge ml-2">Your pick</span>
                </div>
              </div>
              <div v-if="w.explain" class="mt-3 text-xs text-text-3">{{ w.explain }}</div>
            </div>
          </div>
        </div>

        <div v-else class="mt-6 alert alert-ok" role="status">
          Tip: If you refresh this page, your detailed mistake breakdown may disappear (scoreboard will still work).
        </div>
      </div>
    </AppCard>
  </div>
</template>
