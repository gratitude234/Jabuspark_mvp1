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

const profile = computed(() => auth.user?.profile || {})

// Keep course selection stable even if profile arrives later
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
const openItem = ref(null)

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)

const courseOptions = computed(() => {
  const opts = myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` }))
  return [{ value: null, label: 'All my courses' }, ...opts]
})

const itemsByCourse = computed(() => {
  const list = content.materials || []
  const cid = selectedCourseId.value
  if (!cid) return list
  return list.filter(m => m.courseId === cid)
})

const items = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return itemsByCourse.value
  return itemsByCourse.value.filter(m => {
    const hay = [m.title, m.type, ...(m.tags || [])].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
})

async function retry() {
  await Promise.allSettled([
    data.fetchProgress(),
    content.fetchMaterials({ courseId: selectedCourseId.value || '' })
  ])
}

watch(
  () => [auth.isAuthed, selectedCourseId.value],
  async ([isAuthed, cid]) => {
    if (!isAuthed) return
    await content.fetchMaterials({ courseId: cid || '' })
  },
  { immediate: true }
)

onMounted(async () => {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
})

async function toggleSave(m) {
  await data.toggleSave('materials', m.id)
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="min-w-0">
          <div class="h1">Materials</div>
          <p class="sub mt-1">Lecture notes, handouts, and course PDFs.</p>
        </div>

        <div class="w-full sm:w-[340px]">
          <label class="label" for="matcourse">Course</label>
          <AppSelect
            id="matcourse"
            v-model="selectedCourseId"
            :options="courseOptions"
            placeholder="All my courses"
          />
          <p class="help">Showing {{ items.length }} item(s).</p>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="matsearch">Search</label>
          <AppInput id="matsearch" v-model="query" placeholder="Search materials…" />
        </div>
      </div>

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">
        <div class="flex items-center justify-between gap-2">
          <span>{{ content.error }}</span>
          <button type="button" class="btn btn-ghost" @click="retry">Retry</button>
        </div>
      </div>
    </AppCard>

    <AppCard v-if="content.loading.materials">
      <div class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <AppCard v-else-if="items.length === 0">
      <div class="h2">No materials found</div>
      <p class="sub mt-1">Try a different course or search term. New items are added regularly.</p>
      <div class="mt-3 flex gap-2">
        <button type="button" class="btn btn-ghost" @click="retry">Refresh</button>
        <RouterLink to="/saved" class="btn btn-ghost">View saved</RouterLink>
      </div>
    </AppCard>

    <div v-else class="grid gap-3">
      <div v-for="m in items" :key="m.id" class="card card-pad">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="min-w-0">
            <div class="text-base sm:text-lg font-extrabold truncate">{{ m.title }}</div>
            <div class="text-sm text-text-2 mt-1">
              <span v-if="m.type">{{ m.type }}</span>
              <span v-if="m.uploadedAt" class="text-text-3">•</span>
              <span v-if="m.uploadedAt">{{ m.uploadedAt }}</span>
            </div>
            <div v-if="m.tags?.length" class="mt-2 flex flex-wrap gap-2">
              <span v-for="t in m.tags" :key="t" class="badge">{{ t }}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 sm:justify-end">
            <AppButton variant="ghost" size="sm" @click="toggleSave(m)">
              {{ data.isSaved('materials', m.id) ? 'Saved' : 'Save' }}
            </AppButton>
            <AppButton variant="ghost" size="sm" @click="openItem = m">Preview</AppButton>
            <a class="btn btn-ghost btn-sm" :href="m.fileUrl" target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>
      </div>
    </div>

    <PdfModal
      :open="!!openItem"
      :title="openItem?.title || 'Material'"
      :url="openItem?.fileUrl || ''"
      @close="openItem = null"
    />
  </div>
</template>
