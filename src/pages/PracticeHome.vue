Next page to improve is the practice page...



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

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)
const courseOptions = computed(() => myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` })))

watch(selectedCourseId, async (cid) => {
  await content.fetchBanks({ courseId: cid || '' })
})

onMounted(async () => {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
  await content.fetchBanks({ courseId: selectedCourseId.value || '' })
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
          <AppInput
            id="banksearch"
            v-model="query"
            placeholder="Search banks…"
          />
        </div>
      </div>

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">{{ content.error }}</div>
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
