<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'

const auth = useAuthStore()
const catalog = useCatalogStore()
const data = useDataStore()

const profile = computed(() => auth.user?.profile || {})
const selectedCourseId = ref('')
const loading = ref(false)
const error = ref('')

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)
const courseOptions = computed(() => [
  { value: '', label: 'All my courses' },
  ...myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` })),
])

const board = computed(() => data.leaderboard || { items: [], me: null, week: '' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    await data.fetchLeaderboard({ courseId: selectedCourseId.value, limit: 50 })
  } catch (e) {
    error.value = e?.message || 'Failed to load leaderboard'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await catalog.fetchCourses()
  // default to first course if they have one
  if (!selectedCourseId.value && (profile.value.courseIds || []).length) {
    selectedCourseId.value = ''
  }
  await load()
})

watch(selectedCourseId, () => load())

function fmtTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Weekly Leaderboard</div>
          <p class="sub mt-1">Ranks reset every week (Mon–Sun). Practice more to climb.</p>

          <div v-if="board?.me" class="mt-4 card card-pad">
            <div class="text-sm font-extrabold">You</div>
            <div class="mt-2 grid grid-cols-4 gap-2 text-center">
              <div class="chip">
                <div class="text-xs text-text-3">Rank</div>
                <div class="text-base font-extrabold">#{{ board.me.rank }}</div>
              </div>
              <div class="chip">
                <div class="text-xs text-text-3">Correct</div>
                <div class="text-base font-extrabold">{{ board.me.correct }}</div>
              </div>
              <div class="chip">
                <div class="text-xs text-text-3">Attempts</div>
                <div class="text-base font-extrabold">{{ board.me.attempts }}</div>
              </div>
              <div class="chip">
                <div class="text-xs text-text-3">Time</div>
                <div class="text-base font-extrabold">{{ fmtTime(board.me.seconds) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="w-full sm:w-[340px]">
          <label class="label" for="course">Course</label>
          <AppSelect id="course" v-model="selectedCourseId" :options="courseOptions" />
          <p class="help">Tip: choose a course to see who is topping that course.</p>
        </div>
      </div>

      <div v-if="error" class="alert alert-warn mt-4" role="alert">{{ error }}</div>

      <div class="mt-4">
        <div v-if="loading" class="grid gap-2">
          <div class="skeleton h-14" />
          <div class="skeleton h-14" />
          <div class="skeleton h-14" />
        </div>

        <div v-else-if="!board.items?.length" class="card card-pad">
          <div class="h2">No activity yet</div>
          <p class="sub mt-1">Be the first to practice this week.</p>
        </div>

        <div v-else class="grid gap-2">
          <div
            v-for="row in board.items"
            :key="row.userId"
            class="card card-pad"
            :class="row.userId === (auth.user?.id || auth.user?.userId) ? 'ring-1 ring-white/10 bg-white/[0.04]' : ''"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">#{{ row.rank }} • {{ row.name }}</div>
                <div class="text-xs text-text-3 mt-1">
                  {{ row.correct }} correct • {{ row.attempts }} attempts • {{ fmtTime(row.seconds) }}
                </div>
              </div>
              <div class="badge">{{ row.correct }}</div>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
