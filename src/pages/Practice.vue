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

const selectedCourseId = ref(profile.value.courseIds?.[0] || null)
const query = ref('')
const modeFilter = ref('all')
const sortBy = ref('recommended')

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)

const courseOptions = computed(() => {
  const list = myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` }))
  return [{ value: null, label: 'All my courses' }, ...list]
})

const modeOptions = computed(() => ([
  { value: 'all', label: 'All modes' },
  { value: 'mcq', label: 'MCQ' },
  { value: 'flash', label: 'Flash' },
  { value: 'mixed', label: 'Mixed' }
]))

const sortOptions = computed(() => ([
  { value: 'recommended', label: 'Recommended' },
  { value: 'questions_desc', label: 'Most questions' },
  { value: 'questions_asc', label: 'Fewest questions' },
  { value: 'title_asc', label: 'Title (A–Z)' }
]))

// Keep selectedCourseId sane when auth loads after mount
watch(
  () => profile.value.courseIds,
  (ids) => {
    if (!selectedCourseId.value && ids?.length) selectedCourseId.value = ids[0]
  },
  { immediate: true }
)

watch(selectedCourseId, async (cid) => {
  await content.fetchBanks({ courseId: cid || '' })
})

onMounted(async () => {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
  await content.fetchBanks({ courseId: selectedCourseId.value || '' })
})

const filteredBanks = computed(() => {
  const list = content.banks || []
  const q = query.value.trim().toLowerCase()
  const mf = modeFilter.value

  return list.filter((b) => {
    const hay = [b.title, b.mode].filter(Boolean).join(' ').toLowerCase()
    const matchQuery = !q || hay.includes(q)
    const matchMode = mf === 'all' ? true : String(b.mode || '').toLowerCase() === mf
    return matchQuery && matchMode
  })
})

const sortedBanks = computed(() => {
  const list = [...filteredBanks.value]
  const s = sortBy.value

  if (s === 'questions_desc') return list.sort((a, b) => (b.questionCount || 0) - (a.questionCount || 0))
  if (s === 'questions_asc') return list.sort((a, b) => (a.questionCount || 0) - (b.questionCount || 0))
  if (s === 'title_asc') return list.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))

  // "recommended": keep API order (often curated). If not curated, it's still stable.
  return list
})

const totalCount = computed(() => (content.banks || []).length)
const visibleCount = computed(() => sortedBanks.value.length)

function clearSearch() {
  query.value = ''
}

function modeLabel(mode) {
  const m = String(mode || '').toLowerCase()
  if (m === 'mcq') return 'MCQ'
  if (m === 'flash') return 'Flash'
  if (m === 'mixed') return 'Mixed'
  return mode || 'Practice'
}

function modeBadgeClass(mode) {
  const m = String(mode || '').toLowerCase()
  if (m === 'mcq') return 'badge badge-soft'
  if (m === 'flash') return 'badge badge-soft'
  if (m === 'mixed') return 'badge badge-soft'
  return 'badge'
}
</script>

<template>
  <div class="page">
    <!-- Hero / Summary -->
    <AppCard class="relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none opacity-40">
        <div class="h-full w-full bg-gradient-to-br from-accent/25 via-transparent to-transparent" />
      </div>

      <div class="relative flex flex-col gap-5">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <div class="h1">Practice</div>
              <span class="badge badge-soft">Fast drills</span>
            </div>

            <p class="sub mt-1 max-w-[60ch]">
              Quick, focused questions to build recall and exam confidence.
            </p>

            <div class="mt-4 grid grid-cols-3 gap-2">
              <StatPill label="Streak" :value="data.progress.streak" />
              <StatPill label="Accuracy" :value="data.progress.accuracy + '%'" />
              <StatPill label="Answered" :value="data.progress.totalAnswered" />
            </div>
          </div>

          <div class="w-full sm:w-[360px]">
            <label class="label" for="course">Course</label>
            <AppSelect
              id="course"
              v-model="selectedCourseId"
              :options="courseOptions"
              placeholder="All my courses"
            />
            <p class="help mt-1">Choose a course to see focused banks.</p>
          </div>
        </div>

        <!-- Controls -->
        <div class="grid gap-3 sm:grid-cols-12">
          <div class="sm:col-span-6">
            <label class="label" for="banksearch">Search banks</label>
            <div class="flex gap-2">
              <AppInput
                id="banksearch"
                v-model="query"
                placeholder="Search by title or mode…"
              />
              <button
                class="btn btn-ghost"
                type="button"
                :disabled="!query"
                @click="clearSearch"
                aria-label="Clear search"
                title="Clear"
              >
                Clear
              </button>
            </div>
          </div>

          <div class="sm:col-span-3">
            <label class="label" for="mode">Mode</label>
            <AppSelect id="mode" v-model="modeFilter" :options="modeOptions" />
          </div>

          <div class="sm:col-span-3">
            <label class="label" for="sort">Sort</label>
            <AppSelect id="sort" v-model="sortBy" :options="sortOptions" />
          </div>
        </div>

        <div class="flex items-center justify-between text-sm text-text-3">
          <div>
            Showing <span class="text-text font-semibold">{{ visibleCount }}</span>
            of <span class="text-text font-semibold">{{ totalCount }}</span>
          </div>
          <div v-if="query || modeFilter !== 'all'" class="text-xs">
            Tip: clear filters to see everything.
          </div>
        </div>

        <div v-if="content.error" class="alert alert-warn" role="alert" aria-live="polite">
          {{ content.error }}
        </div>
      </div>
    </AppCard>

    <!-- Loading -->
    <AppCard v-if="content.loading.banks">
      <div class="flex items-center justify-between mb-3">
        <div class="h2">Loading banks…</div>
        <span class="badge badge-soft">Please wait</span>
      </div>
      <div class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <!-- Empty -->
    <AppCard v-else-if="sortedBanks.length === 0">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="h2">No banks found</div>
          <p class="sub mt-1 max-w-[70ch]">
            Try a different course or clear filters. New banks may be added over time.
          </p>

          <div class="mt-4 flex flex-col sm:flex-row gap-2">
            <button class="btn btn-ghost" type="button" @click="query = ''; modeFilter = 'all'; sortBy = 'recommended'">
              Clear filters
            </button>
          </div>
        </div>

        <div class="hidden sm:block">
          <div class="glass rounded-xl2 border border-stroke/60 px-4 py-3">
            <div class="text-xs text-text-3">Suggestion</div>
            <div class="text-sm font-semibold mt-1">Pick “All my courses”</div>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- List -->
    <div v-else class="grid gap-3">
      <RouterLink
        v-for="b in sortedBanks"
        :key="b.id"
        :to="`/practice/${b.id}`"
        class="card card-press card-pad group"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <div class="text-base font-extrabold truncate group-hover:underline">
                {{ b.title }}
              </div>
              <span :class="modeBadgeClass(b.mode)">{{ modeLabel(b.mode) }}</span>
            </div>

            <div class="text-sm text-text-2 mt-1">
              <span class="font-semibold text-text">{{ b.questionCount }}</span> questions
              <span class="text-text-3">•</span>
              Tap to start
            </div>
          </div>

          <div class="flex flex-col items-end gap-2">
            <span class="badge">Start</span>
            <span class="text-xs text-text-3 hidden sm:block">Enter bank</span>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
