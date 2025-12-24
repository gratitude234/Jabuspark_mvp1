<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppInput from '../components/AppInput.vue'
import AppSelect from '../components/AppSelect.vue'
import StatPill from '../components/StatPill.vue'

const auth = useAuthStore()
const catalog = useCatalogStore()
const content = useContentStore()
const data = useDataStore()

const profile = computed(() => auth.user?.profile || {})

// Keep course selection stable, even if profile arrives later
const selectedCourseId = ref(null)
watch(
  () => profile.value.courseIds,
  (ids) => {
    const first = (ids || [])[0] || null
    if (!selectedCourseId.value) selectedCourseId.value = first
    if (selectedCourseId.value && !(ids || []).includes(selectedCourseId.value)) {
      selectedCourseId.value = first
    }
  },
  { immediate: true }
)

const query = ref('')

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)

const courseOptions = computed(() => {
  const opts = myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` }))
  return [{ value: null, label: 'All my courses' }, ...opts]
})

const lastActive = computed(() => data.progress.lastActive || null)
const continueBank = computed(() => {
  const bankId = lastActive.value?.bankId
  if (!bankId) return null
  return (content.banks || []).find(b => b.id === bankId) || null
})

const banks = computed(() => {
  const list = content.banks || []
  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((b) => {
    const hay = [b.title, b.mode].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
})

async function retry() {
  await Promise.allSettled([
    data.fetchProgress(),
    content.fetchBanks({ courseId: selectedCourseId.value || '' })
  ])
}

// Fetch catalog + progress once
onMounted(async () => {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
})

// Fetch banks when authenticated and when course filter changes (single pipeline)
watch(
  () => [auth.isAuthed, selectedCourseId.value],
  async ([isAuthed, courseId]) => {
    if (!isAuthed) return
    await content.fetchBanks({ courseId: courseId || '' })
  },
  { immediate: true }
)
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Practice</div>
          <p class="sub mt-1">Quick drills to boost recall and exam confidence.</p>

          <div class="mt-4 grid grid-cols-3 gap-2">
            <StatPill label="Streak" :value="data.progress.streak" />
            <StatPill label="Accuracy" :value="data.progress.accuracy + '%'" />
            <StatPill label="Answered" :value="data.progress.totalAnswered" />
          </div>

          <div v-if="continueBank" class="mt-4">
            <RouterLink class="btn btn-primary" :to="`/practice/${continueBank.id}?resume=1`">
              Continue
            </RouterLink>
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
          <p class="help">Tip: choose a course to see focused banks.</p>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="banksearch">Search</label>
          <AppInput id="banksearch" v-model="query" placeholder="Search banks…" />
        </div>
      </div>

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">
        <div class="flex items-center justify-between gap-2">
          <span>{{ content.error }}</span>
          <button type="button" class="btn btn-ghost" @click="retry">Retry</button>
        </div>
      </div>
    </AppCard>

    <AppCard v-if="content.loading.banks">
      <div class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <AppCard v-else-if="banks.length === 0">
      <div class="h2">No banks found</div>
      <p class="sub mt-1">
        Try selecting a different course, or check back later as new banks are added.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="btn btn-ghost" @click="retry">Refresh</button>
        <RouterLink to="/profile" class="btn btn-ghost">Update profile</RouterLink>
      </div>
    </AppCard>

    <div v-else class="grid gap-3">
      <RouterLink
        v-for="b in banks"
        :key="b.id"
        :to="`/practice/${b.id}`"
        class="card card-press card-pad"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-base font-extrabold truncate">{{ b.title }}</div>
            <div class="text-sm text-text-2 mt-1">
              {{ b.questionCount }} questions
              <span class="text-text-3">•</span>
              {{ b.mode }}
            </div>
          </div>

          <div class="flex flex-col items-end gap-2">
            <span class="badge">Start</span>
            <span class="text-xs text-text-3">Tap to open</span>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
