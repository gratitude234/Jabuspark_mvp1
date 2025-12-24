<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import { useCatalogStore } from '../stores/catalog'
import { useContentStore } from '../stores/content'
import AppCard from '../components/AppCard.vue'
import AppInput from '../components/AppInput.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'
import PdfModal from '../components/PdfModal.vue'

const auth = useAuthStore()
const data = useDataStore()
const catalog = useCatalogStore()
const content = useContentStore()

const selectedCourseId = ref(auth.user?.profile?.courseIds?.[0] || null)
const query = ref('')
const openItem = ref(null)

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (auth.user?.profile?.courseIds || []).includes(c.id))
)
const courseOptions = computed(() => myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` })))

const itemsByCourse = computed(() =>
  (content.pastQuestions || []).filter(pq => !selectedCourseId.value || pq.courseId === selectedCourseId.value)
)

const items = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return itemsByCourse.value
  return itemsByCourse.value.filter(pq => {
    const hay = [pq.title, pq.session, pq.semester, pq.uploadedAt].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
})

watch(selectedCourseId, async (cid) => {
  await content.fetchPastQuestions({ courseId: cid || '' })
})

onMounted(async () => {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
  await content.fetchPastQuestions({ courseId: selectedCourseId.value || '' })
})

async function toggleSave(pq) {
  await data.toggleSave('pastQuestions', pq.id)
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="min-w-0">
          <div class="h1">Past Questions</div>
          <p class="sub mt-1">Preview PDFs, open in a new tab, or save for later.</p>
        </div>

        <div class="w-full sm:w-[340px]">
          <label class="label" for="pqcourse">Course</label>
          <AppSelect
            id="pqcourse"
            v-model="selectedCourseId"
            :options="courseOptions"
            placeholder="All my courses"
          />
          <p class="help">Showing {{ items.length }} item(s).</p>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="pqsearch">Search</label>
          <AppInput
            id="pqsearch"
            v-model="query"
            placeholder="Search by title, session, semester…"
          />
        </div>
      </div>

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">{{ content.error }}</div>
    </AppCard>

    <AppCard v-if="content.loading.pastQuestions">
      <div class="grid gap-2">
        <div class="skeleton h-20" />
        <div class="skeleton h-20" />
        <div class="skeleton h-20" />
      </div>
    </AppCard>

    <AppCard v-else-if="items.length === 0">
      <div class="h2">No past questions found</div>
      <p class="sub mt-1">Try selecting a different course, or check back later.</p>
      <RouterLink to="/materials" class="btn btn-ghost mt-4">Browse materials</RouterLink>
    </AppCard>

    <div v-else class="grid gap-3">
      <div v-for="pq in items" :key="pq.id" class="card card-pad">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="min-w-0">
            <div class="text-base sm:text-lg font-extrabold truncate">{{ pq.title }}</div>
            <div class="text-sm text-text-2 mt-1">
              {{ pq.session }} <span class="text-text-3">•</span> {{ pq.semester }}
              <span v-if="pq.uploadedAt" class="text-text-3">•</span>
              <span v-if="pq.uploadedAt">{{ pq.uploadedAt }}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 sm:justify-end">
            <AppButton variant="ghost" size="sm" @click="toggleSave(pq)">
              {{ data.isSaved('pastQuestions', pq.id) ? 'Saved' : 'Save' }}
            </AppButton>
            <AppButton variant="primary" size="sm" @click="openItem = pq">Preview</AppButton>
            <a class="btn btn-ghost btn-sm" :href="pq.fileUrl" target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>
      </div>
    </div>

    <PdfModal
      :open="!!openItem"
      :title="openItem?.title || 'Past question'"
      :url="openItem?.fileUrl || ''"
      @close="openItem = null"
    />
  </div>
</template>
