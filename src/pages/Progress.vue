<script setup>
import { computed, onMounted, ref } from 'vue'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'

const data = useDataStore()

const loading = ref(false)
const error = ref('')
const expanded = ref({}) // { [courseId]: boolean }

const courses = computed(() => data.courseProgress || [])

const formatTime = (seconds = 0) => {
  const s = Math.max(0, Number(seconds) || 0)
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${mm}m`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await data.fetchCourseProgress()
  } catch (e) {
    error.value = e?.message || 'Failed to load progress.'
  } finally {
    loading.value = false
  }
}

async function toggle(courseId) {
  expanded.value = { ...expanded.value, [courseId]: !expanded.value[courseId] }
  if (expanded.value[courseId] && !data.courseTrends?.[courseId]) {
    await data.fetchCourseTrend(courseId, { days: 14 })
  }
}

const trendFor = (courseId) => data.courseTrends?.[courseId] || []

onMounted(load)
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Progress</div>
          <p class="sub mt-1">
            Your performance per course based on attempts (accuracy, time, and review backlog).
          </p>
        </div>

        <div class="flex gap-2">
          <AppButton variant="ghost" :disabled="loading" @click="load">Refresh</AppButton>
        </div>
      </div>
    </AppCard>

    <AppCard v-if="loading && courses.length === 0" class="mt-3">
      <div class="skeleton h-16" />
      <div class="skeleton h-16 mt-2" />
      <div class="skeleton h-16 mt-2" />
    </AppCard>

    <AppCard v-else-if="error" class="mt-3">
      <div class="alert alert-warn" role="alert">{{ error }}</div>
    </AppCard>

    <AppCard v-else-if="courses.length === 0" class="mt-3">
      <div class="h2">No data yet</div>
      <p class="sub mt-1">Start practicing to build your stats.</p>
    </AppCard>

    <div v-else class="grid gap-3 mt-3">
      <AppCard v-for="c in courses" :key="c.courseId">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="h2">{{ c.code }} <span class="text-text-3">• L{{ c.level }}</span></div>
            <div class="text-sm text-text-2 mt-1">{{ c.title }}</div>

            <div class="mt-3 flex flex-wrap gap-2">
              <span class="badge">Accuracy: {{ c.accuracy }}%</span>
              <span class="badge badge-soft">Attempts: {{ c.attempts }}</span>
              <span class="badge badge-soft">Study: {{ formatTime(c.studySeconds) }}</span>
              <span v-if="c.dueReviews" class="badge badge-warn">Due reviews: {{ c.dueReviews }}</span>
            </div>
          </div>

          <div class="flex flex-col items-end gap-2">
            <AppButton variant="ghost" size="sm" @click="toggle(c.courseId)">
              {{ expanded[c.courseId] ? 'Hide trend' : 'View trend' }}
            </AppButton>
          </div>
        </div>

        <div v-if="expanded[c.courseId]" class="mt-4">
          <div class="text-xs text-text-3 mb-2">Accuracy trend (last 14 days)</div>

          <div v-if="trendFor(c.courseId).length === 0" class="text-sm text-text-2">
            No attempts in the last 14 days.
          </div>

          <div v-else class="grid gap-2">
            <div
              v-for="p in trendFor(c.courseId)"
              :key="p.date"
              class="flex items-center gap-3"
            >
              <div class="w-24 text-xs text-text-3">{{ p.date }}</div>
              <div class="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div class="h-full bg-accent transition-all duration-200" :style="{ width: p.accuracy + '%' }" />
              </div>
              <div class="w-16 text-right text-xs font-semibold">{{ p.accuracy }}%</div>
              <div class="w-20 text-right text-xs text-text-3">{{ p.attempts }} q</div>
            </div>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>
