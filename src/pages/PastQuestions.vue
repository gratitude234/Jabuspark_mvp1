<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const showSavedOnly = ref(false)
const sortKey = ref('recent') // 'recent' | 'title' | 'session'

const filtersOpen = ref(false)
let mq
let mqHandler

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (auth.user?.profile?.courseIds || []).includes(c.id))
)

const courseOptions = computed(() => [
  { value: null, label: 'All my courses' },
  ...myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` })),
])

const sortOptions = [
  { value: 'recent', label: 'Most recent' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'session', label: 'Session/Semester' },
]

const itemsByCourse = computed(() =>
  (content.pastQuestions || []).filter(pq => !selectedCourseId.value || pq.courseId === selectedCourseId.value)
)

function normalizeText(v) {
  return (v || '').toString().trim().toLowerCase()
}

const filteredItems = computed(() => {
  const q = normalizeText(query.value)
  let list = itemsByCourse.value

  if (q) {
    list = list.filter(pq => {
      const hay = [pq.title, pq.session, pq.semester, pq.uploadedAt]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }

  if (showSavedOnly.value) {
    list = list.filter(pq => data.isSaved('pastQuestions', pq.id))
  }

  return [...list].sort((a, b) => {
    if (sortKey.value === 'title') return normalizeText(a.title).localeCompare(normalizeText(b.title))
    if (sortKey.value === 'session') {
      const sa = `${normalizeText(a.session)} ${normalizeText(a.semester)}`
      const sb = `${normalizeText(b.session)} ${normalizeText(b.semester)}`
      return sa.localeCompare(sb)
    }
    // recent
    const da = Date.parse(a.uploadedAt || '') || 0
    const db = Date.parse(b.uploadedAt || '') || 0
    if (db !== da) return db - da
    return normalizeText(a.title).localeCompare(normalizeText(b.title))
  })
})

const totalCount = computed(() => filteredItems.value.length)
const hasFilters = computed(() =>
  Boolean(selectedCourseId.value) ||
  Boolean(query.value.trim()) ||
  showSavedOnly.value ||
  sortKey.value !== 'recent'
)

const activeFilterCount = computed(() => {
  let n = 0
  if (selectedCourseId.value) n++
  if (showSavedOnly.value) n++
  if (sortKey.value !== 'recent') n++
  return n
})

function clearSearch() {
  query.value = ''
}

function resetFilters() {
  selectedCourseId.value = null
  showSavedOnly.value = false
  sortKey.value = 'recent'
}

watch(selectedCourseId, async (cid) => {
  await content.fetchPastQuestions({ courseId: cid || '' })
})

onMounted(async () => {
  // Desktop: filters open. Mobile: closed by default.
  if (typeof window !== 'undefined' && window.matchMedia) {
    mq = window.matchMedia('(min-width: 640px)')
    mqHandler = (e) => {
      if (e.matches) filtersOpen.value = true
      else filtersOpen.value = false
    }
    filtersOpen.value = mq.matches
    try {
      mq.addEventListener('change', mqHandler)
    } catch {
      mq.addListener(mqHandler)
    }
  }

  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
  await content.fetchPastQuestions({ courseId: selectedCourseId.value || '' })
})

onBeforeUnmount(() => {
  if (!mq || !mqHandler) return
  try {
    mq.removeEventListener('change', mqHandler)
  } catch {
    mq.removeListener(mqHandler)
  }
})

async function toggleSave(pq) {
  if (!pq?.id) return
  await data.toggleSave('pastQuestions', pq.id)
}

function openPreview(pq) {
  openItem.value = pq
}
</script>

<template>
  <div class="page">
    <!-- Header / Toolbar (compact on mobile) -->
    <AppCard class="pq-toolbar">
      <div class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="h1 leading-tight">Past Questions</div>
            <p class="sub mt-1 hidden sm:block">Preview PDFs, open in a new tab, or save for later.</p>
          </div>

          <div class="flex items-center gap-2">
            <span class="pill" aria-live="polite">
              {{ totalCount }} item{{ totalCount === 1 ? '' : 's' }}
            </span>

            <AppButton
              variant="ghost"
              size="sm"
              :aria-pressed="showSavedOnly"
              @click="showSavedOnly = !showSavedOnly"
              title="Show only saved past questions"
            >
              <span class="sm:hidden">{{ showSavedOnly ? 'Saved' : 'All' }}</span>
              <span class="hidden sm:inline">{{ showSavedOnly ? 'Saved only' : 'All items' }}</span>
            </AppButton>
          </div>
        </div>

        <!-- Search row + Filters toggle -->
        <div class="pq-toprow">
          <div class="pq-search">
            <AppInput
              id="pqsearch"
              v-model="query"
              placeholder="Search title, session, semester…"
              class="min-w-0"
            />
            <button
              v-if="query.trim()"
              type="button"
              class="btn btn-ghost btn-sm"
              @click="clearSearch"
              aria-label="Clear search"
              title="Clear search"
            >
              Clear
            </button>
          </div>

          <button
            type="button"
            class="btn btn-ghost btn-sm pq-filters-btn"
            :aria-expanded="filtersOpen ? 'true' : 'false'"
            @click="filtersOpen = !filtersOpen"
          >
            Filters
            <span v-if="activeFilterCount" class="pq-badge">{{ activeFilterCount }}</span>
          </button>
        </div>

        <!-- Collapsible filters -->
        <div v-show="filtersOpen" class="pq-filters">
          <div class="grid gap-2 sm:grid-cols-12">
            <div class="sm:col-span-7">
              <label class="label" for="pqcourse">Course</label>
              <AppSelect
                id="pqcourse"
                v-model="selectedCourseId"
                :options="courseOptions"
                placeholder="All my courses"
              />
              <p class="help hidden sm:block">
                Tip: use search to filter by title, session, or semester.
              </p>
            </div>

            <div class="sm:col-span-5">
              <label class="label" for="pqsort">Sort</label>
              <AppSelect id="pqsort" v-model="sortKey" :options="sortOptions" />
              <div class="flex items-center justify-between mt-2">
                <div class="text-xs text-text-3 hidden sm:block">
                  <span v-if="hasFilters">Filters active</span>
                  <span v-else>Default view</span>
                </div>
                <button
                  v-if="hasFilters"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="resetFilters"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="content.error" class="alert alert-warn" role="alert">
          {{ content.error }}
        </div>
      </div>
    </AppCard>

    <!-- Loading -->
    <AppCard v-if="content.loading?.pastQuestions">
      <div class="grid gap-2">
        <div class="skeleton h-20" />
        <div class="skeleton h-20" />
        <div class="skeleton h-20" />
      </div>
    </AppCard>

    <!-- Empty -->
    <AppCard v-else-if="filteredItems.length === 0">
      <div class="h2">No past questions found</div>
      <p class="sub mt-1">Try adjusting your filters, or check back later.</p>

      <div class="flex flex-wrap gap-2 mt-4">
        <button v-if="hasFilters" type="button" class="btn btn-primary" @click="resetFilters">
          Reset filters
        </button>
        <RouterLink to="/materials" class="btn btn-ghost">Browse materials</RouterLink>
      </div>
    </AppCard>

    <!-- List -->
    <div v-else class="grid gap-2 sm:gap-3">
      <div v-for="pq in filteredItems" :key="pq.id" class="card pq-item">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            class="pq-main text-left min-w-0"
            @click="openPreview(pq)"
            :aria-label="`Preview ${pq.title || 'past question'}`"
          >
            <div class="text-base sm:text-lg font-extrabold truncate">
              {{ pq.title }}
            </div>

            <div class="text-sm text-text-2 mt-1">
              <span v-if="pq.session">{{ pq.session }}</span>
              <span v-if="pq.session && pq.semester" class="text-text-3"> • </span>
              <span v-if="pq.semester">{{ pq.semester }}</span>
              <span v-if="pq.uploadedAt" class="text-text-3"> • </span>
              <span v-if="pq.uploadedAt">{{ pq.uploadedAt }}</span>
            </div>

            <div class="text-xs text-text-3 mt-2 hidden sm:block">
              Tap anywhere here to preview
            </div>
          </button>

          <div class="pq-actions">
            <AppButton
              variant="ghost"
              size="sm"
              @click.stop="toggleSave(pq)"
              :title="data.isSaved('pastQuestions', pq.id) ? 'Saved' : 'Save for later'"
            >
              {{ data.isSaved('pastQuestions', pq.id) ? 'Saved' : 'Save' }}
            </AppButton>

            <AppButton variant="primary" size="sm" @click.stop="openPreview(pq)">
              Preview
            </AppButton>

            <!-- Mobile: Open under More -->
            <details class="pq-more sm:hidden" @click.stop>
              <summary class="btn btn-ghost btn-sm">More</summary>
              <div class="pq-more-menu" @click.stop>
                <a
                  class="btn btn-ghost btn-sm w-full justify-center"
                  :href="pq.fileUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open PDF
                </a>
              </div>
            </details>

            <!-- Desktop: show Open -->
            <a
              class="btn btn-ghost btn-sm hidden sm:inline-flex"
              :href="pq.fileUrl"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >
              Open
            </a>
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

<style scoped>
/* make the toolbar lighter (your screenshot shows it dominating the screen) */
.pq-toolbar {
  padding: 0.75rem !important;
}
@media (min-width: 640px) {
  .pq-toolbar {
    padding: 1.25rem !important;
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(6px);
  }
}

.pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  padding: 0.28rem 0.55rem;
  font-size: 0.75rem;
  line-height: 1rem;
}

/* Search + Filters button row */
.pq-toprow {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: center;
}

.pq-search {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.pq-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.2rem;
  height: 1.2rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  margin-left: 0.35rem;
  font-size: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.pq-filters {
  margin-top: 0.25rem;
}

/* Items */
.pq-item {
  padding: 0.75rem;
}
@media (min-width: 640px) {
  .pq-item {
    padding: 0.95rem;
  }
}

.pq-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  padding: 0;
  background: transparent;
  border: none;
}

.pq-main:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.22);
  outline-offset: 3px;
  border-radius: 0.75rem;
}

.pq-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-start;
}
@media (min-width: 640px) {
  .pq-actions {
    justify-content: flex-end;
  }
}

/* Mobile dropdown */
.pq-more {
  position: relative;
}
.pq-more > summary {
  list-style: none;
}
.pq-more > summary::-webkit-details-marker {
  display: none;
}
.pq-more-menu {
  position: absolute;
  right: 0;
  margin-top: 0.4rem;
  min-width: 10rem;
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(10, 14, 24, 0.95);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  z-index: 20;
}
</style>
