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

const savedOnly = ref(false)
const sortKey = ref('recent') // 'recent' | 'title' | 'type'

// Debounce search to keep UI snappy for large lists
const debouncedQuery = ref('')
let _debounceT
watch(
  query,
  (v) => {
    clearTimeout(_debounceT)
    _debounceT = setTimeout(() => (debouncedQuery.value = v), 150)
  },
  { immediate: true }
)

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (auth.user?.profile?.courseIds || []).includes(c.id))
)

const courseOptions = computed(() =>
  myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` }))
)

const itemsByCourse = computed(() =>
  (content.materials || []).filter(m => !selectedCourseId.value || m.courseId === selectedCourseId.value)
)

const items = computed(() => {
  const q = debouncedQuery.value.trim().toLowerCase()
  let base = itemsByCourse.value

  if (savedOnly.value) {
    base = base.filter(m => data.isSaved('materials', m.id))
  }

  if (q) {
    base = base.filter(m => {
      const hay = [m.title, m.type, ...(m.tags || [])].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }

  const sorted = [...base]
  if (sortKey.value === 'title') sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  if (sortKey.value === 'type') sorted.sort((a, b) => (a.type || '').localeCompare(b.type || ''))
  // 'recent' keeps incoming order
  return sorted
})

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

function applyTag(tag) {
  query.value = tag
}

function clearSearch() {
  query.value = ''
}
</script>

<template>
  <div class="page space-y-3">
    <!-- Sticky header + filters -->
    <AppCard class="sticky top-0 z-10 backdrop-blur bg-surface/80">
      <div class="flex flex-col gap-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="h1">Materials</div>
            <p class="sub mt-1">Lecture notes, handouts, and course PDFs.</p>
          </div>

          <div class="text-sm text-text-3 whitespace-nowrap mt-2" aria-live="polite">
            <span v-if="content.loading.materials">Loading…</span>
            <span v-else>{{ items.length }} material(s)</span>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-12" role="search" aria-label="Materials filters">
          <div class="sm:col-span-4">
            <label class="label" for="matcourse">Course</label>
            <AppSelect
              id="matcourse"
              v-model="selectedCourseId"
              :options="courseOptions"
              placeholder="All my courses"
            />
          </div>

          <div class="sm:col-span-5">
            <label class="label" for="matsearch">Search</label>
            <div class="relative">
              <AppInput
                id="matsearch"
                v-model="query"
                placeholder="Search by title, type, or tag…"
              />
              <button
                v-if="query.trim()"
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
                @click="clearSearch"
                aria-label="Clear search"
              >
                Clear
              </button>
            </div>
          </div>

          <div class="sm:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label class="label" for="matsort">Sort</label>
              <AppSelect
                id="matsort"
                v-model="sortKey"
                :options="[
                  { value: 'recent', label: 'Recent' },
                  { value: 'title', label: 'Title (A–Z)' },
                  { value: 'type', label: 'Type' }
                ]"
              />
            </div>

            <div class="flex flex-col justify-end">
              <label class="label opacity-0">Saved</label>
              <AppButton
                :variant="savedOnly ? 'primary' : 'ghost'"
                size="sm"
                class="w-full"
                type="button"
                @click="savedOnly = !savedOnly"
                :aria-pressed="savedOnly"
              >
                {{ savedOnly ? 'Saved only' : 'All items' }}
              </AppButton>
            </div>
          </div>
        </div>

        <div v-if="content.error" class="alert alert-warn" role="alert">
          {{ content.error }}
        </div>
      </div>
    </AppCard>

    <!-- Loading -->
    <div v-if="content.loading.materials" class="grid gap-3">
      <AppCard v-for="n in 6" :key="n">
        <div class="grid gap-2">
          <div class="skeleton h-6 w-3/4" />
          <div class="skeleton h-4 w-2/3" />
          <div class="flex gap-2 mt-2">
            <div class="skeleton h-9 w-24" />
            <div class="skeleton h-9 w-24" />
            <div class="skeleton h-9 w-16" />
          </div>
        </div>
      </AppCard>
    </div>

    <!-- Empty -->
    <AppCard v-else-if="items.length === 0">
      <div class="h2">No materials found</div>
      <p class="sub mt-1">
        Try a different course, clear your search, or save materials to find them quickly later.
      </p>
      <div class="mt-4 flex flex-col sm:flex-row gap-2">
        <AppButton variant="ghost" size="sm" @click="clearSearch">Clear search</AppButton>
        <RouterLink to="/practice" class="btn btn-primary btn-sm">Go to practice</RouterLink>
      </div>
    </AppCard>

    <!-- Results -->
    <div v-else class="grid gap-3">
      <div
        v-for="m in items"
        :key="m.id"
        class="card card-pad card-press outline-none focus:ring-2 focus:ring-accent/40"
        tabindex="0"
        @keydown.enter.prevent="openItem = m"
      >
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="min-w-0">
            <div class="text-base sm:text-lg font-extrabold truncate">{{ m.title }}</div>

            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span v-if="m.type" class="badge">{{ m.type }}</span>

              <button
                v-for="t in (m.tags || []).slice(0, 6)"
                :key="t"
                type="button"
                class="chip"
                @click="applyTag(t)"
                :aria-label="`Filter by tag ${t}`"
              >
                {{ t }}
              </button>

              <span v-if="(m.tags || []).length > 6" class="text-text-3">
                +{{ (m.tags || []).length - 6 }} more
              </span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 sm:justify-end">
            <AppButton
              variant="ghost"
              size="sm"
              @click="toggleSave(m)"
              :aria-pressed="data.isSaved('materials', m.id)"
              :aria-label="data.isSaved('materials', m.id) ? 'Unsave material' : 'Save material'"
            >
              {{ data.isSaved('materials', m.id) ? 'Saved' : 'Save' }}
            </AppButton>

            <AppButton variant="primary" size="sm" @click="openItem = m">
              Preview
            </AppButton>

            <a
              class="btn btn-ghost btn-sm"
              :href="m.fileUrl"
              target="_blank"
              rel="noreferrer"
              aria-label="Open PDF in new tab"
            >
              Open
            </a>
          </div>
        </div>
      </div>
    </div>

    <PdfModal
      :docType="'materials'"
      :docId="openItem?.id || ''"
      :open="!!openItem"
      :title="openItem?.title || 'Material'"
      :url="openItem?.fileUrl || ''"
      @close="openItem = null"
    />
  </div>
</template>

<style scoped>
/* Tag chips: small, scannable, clickable */
.chip {
  padding: 0.25rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  line-height: 1rem;
  background: rgba(0, 0, 0, 0.06);
  transition: background 0.15s ease;
}
.chip:hover {
  background: rgba(0, 0, 0, 0.10);
}
.chip:focus {
  outline: 2px solid rgba(0, 0, 0, 0.25);
  outline-offset: 2px;
}
</style>
