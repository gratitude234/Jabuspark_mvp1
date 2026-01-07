<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import { useRememberedCourseId } from '../composables/useRememberedCourseId'

const auth = useAuthStore()
const catalog = useCatalogStore()
const data = useDataStore()

const profile = computed(() => auth.user?.profile || {})
const loading = ref(false)
const error = ref('')

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)

// UX: remember last selected course instead of defaulting to the first one.
const selectedCourseId = useRememberedCourseId('lastCourseId.leaderboard', {
  getAllowedIds: () => myCourses.value.map(c => c.id),
  defaultValue: null, // All my courses
})

const courseOptions = computed(() =>
  myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` }))
)

const board = computed(() => data.leaderboard || { items: [], me: null, week: '' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    await data.fetchLeaderboard({ courseId: selectedCourseId.value || '', limit: 50 })
  } catch (e) {
    error.value = e?.message || 'Failed to load leaderboard'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await catalog.fetchCourses()
  await load()
})

watch(selectedCourseId, () => load())

function fmtTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

const isMe = (row) => row.userId === (auth.user?.id || auth.user?.userId)
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Weekly Leaderboard</div>
          <p class="sub mt-1">Ranks reset every week (Mon–Sun). Practice more to climb.</p>

          <!-- Me card: 2 cols on mobile, 4 on desktop -->
          <div v-if="board?.me" class="mt-4 card card-pad">
            <div class="text-sm font-extrabold">You</div>

            <div class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
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
          <AppSelect
            id="course"
            v-model="selectedCourseId"
            :options="courseOptions"
            placeholder="All my courses"
          />
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
            :class="isMe(row) ? 'ring-1 ring-white/10 bg-white/[0.04]' : ''"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <!-- FIX: force long names/emails to wrap instead of overflowing -->
                <div class="leader-name text-sm font-extrabold leading-snug">
                  #{{ row.rank }} • {{ row.name }}
                </div>

                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-3">
                  <span class="meta-pill">{{ row.correct }} correct</span>
                  <span class="meta-pill">{{ row.attempts }} attempts</span>
                  <span class="meta-pill">{{ fmtTime(row.seconds) }}</span>
                </div>
              </div>

              <div class="score-badge" aria-label="Correct answers">
                {{ row.correct }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
/* ✅ This is the key fix: emails/long tokens won't overflow anymore */
.leader-name {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere; /* breaks long emails nicely */
  word-break: break-word;  /* fallback */
  overflow: hidden;

  /* 2-line clamp (works even with long emails now) */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* Reusable small pills for row meta */
.meta-pill {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.06);
  line-height: 1rem;
  white-space: nowrap;
}

/* Bigger, consistent score badge on mobile */
.score-badge {
  min-width: 44px;
  height: 44px;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 0.9rem;
  background: rgba(0, 0, 0, 0.08);
}
</style>
