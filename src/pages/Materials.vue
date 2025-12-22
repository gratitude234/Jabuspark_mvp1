<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import { useCatalogStore } from '../stores/catalog'
import { useContentStore } from '../stores/content'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'
import PdfModal from '../components/PdfModal.vue'

const auth = useAuthStore()
const data = useDataStore()
const catalog = useCatalogStore()
const content = useContentStore()

const selectedCourseId = ref(auth.user?.profile?.courseIds?.[0] || null)
const openItem = ref(null)

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (auth.user?.profile?.courseIds || []).includes(c.id))
)
const courseOptions = computed(() => myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` })))

const items = computed(() =>
  (content.materials || []).filter(m => !selectedCourseId.value || m.courseId === selectedCourseId.value)
)

watch(selectedCourseId, async (cid) => {
  await content.fetchMaterials({ courseId: cid || '' })
})

onMounted(async () => {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
  await content.fetchMaterials({ courseId: selectedCourseId.value || '' })
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

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">{{ content.error }}</div>
    </AppCard>

    <AppCard v-if="content.loading.materials">
      <div class="grid gap-2">
        <div class="skeleton h-20" />
        <div class="skeleton h-20" />
        <div class="skeleton h-20" />
      </div>
    </AppCard>

    <AppCard v-else-if="items.length === 0">
      <div class="h2">No materials found</div>
      <p class="sub mt-1">Try selecting a different course, or check back later.</p>
      <RouterLink to="/practice" class="btn btn-ghost mt-4">Go to practice</RouterLink>
    </AppCard>

    <div v-else class="grid gap-3">
      <div v-for="m in items" :key="m.id" class="card card-pad">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="min-w-0">
            <div class="text-base sm:text-lg font-extrabold truncate">{{ m.title }}</div>
            <div class="text-sm text-text-2 mt-1">
              <span v-if="m.type">{{ m.type }}</span>
              <span v-if="m.type && m.tags?.length" class="text-text-3"> • </span>
              <span v-if="m.tags?.length">{{ m.tags.join(', ') }}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 sm:justify-end">
            <AppButton variant="ghost" size="sm" @click="toggleSave(m)">
              {{ data.isSaved('materials', m.id) ? 'Saved' : 'Save' }}
            </AppButton>
            <AppButton variant="primary" size="sm" @click="openItem = m">Preview</AppButton>
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
