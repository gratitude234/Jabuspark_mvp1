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
const isSmUp = ref(false)

let mq
let mqHandler

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (auth.user?.profile?.courseIds || []).includes(c.id))
)

const courseOptions = computed(() => [
  { value: null, label: 'All my courses' },
  ...myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` }))
])

const sortOptions = [
  { value: 'recent', label: 'Most recent' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'session', label: 'Session/Semester' }
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
      const hay = [pq.title, pq.session, pq.semester, pq.uploadedAt].filter(Boolean).join(' ').toLowerCase()
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
  // Keep filters closed on mobile, open on >= sm
  if (typeof window !== 'undefined' && window.matchMedia) {
    mq = window.matchMedia('(min-width: 640px)')
    mqHandler = (e) => {
      isSmUp.value = !!e.matches
      filtersOpen.value = !!e.matches
    }
    isSmUp.value = mq.matches
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
  <div class="page pq-page">
    <!-- Compact Mobile Toolbar -->
    <AppCard class="pq-toolbar">
      <div class="pq-head">
        <div class="pq-title-wrap">
          <div class="pq-title">Past Questions</div>
          <div class="pq-count" aria-live="polite">
            {{ totalCount }} item{{ totalCount === 1 ? '' : 's' }}
          </div>
        </div>

        <!-- Segmented control (All / Saved) -->
        <div class="pq-seg" role="tablist" aria-label="View mode">
          <button
            type="button"
            class="pq-seg-btn"
            :class="{ active: !showSavedOnly }"
            :aria-selected="(!showSavedOnly).toString()"
            @click="showSavedOnly = false"
          >
            All
          </button>
          <button
            type="button"
            class="pq-seg-btn"
            :class="{ active: showSavedOnly }"
            :aria-selected="showSavedOnly.toString()"
            @click="showSavedOnly = true"
          >
            Saved
          </button>
        </div>
      </div>

      <div class="pq-controls">
        <div class="pq-search">
          <AppInput
            id="pqsearch"
            v-model="query"
            placeholder="Search title, session, semester…"
            class="pq-search-input"
          />
          <button
            v-if="query.trim()"
            type="button"
            class="pq-clear"
            @click="clearSearch"
            aria-label="Clear search"
            title="Clear search"
          >
            ×
          </button>
        </div>

        <button
          type="button"
          class="pq-filters-btn"
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
          </div>

          <div class="sm:col-span-5">
            <label class="label" for="pqsort">Sort</label>
            <AppSelect id="pqsort" v-model="sortKey" :options="sortOptions" />

            <div class="pq-filter-foot">
              <div class="pq-filter-hint">
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
    <div v-else class="grid gap-2 sm:gap-3 pq-list">
      <div v-for="pq in filteredItems" :key="pq.id" class="card pq-item">
        <div class="pq-item-top">
          <button
            type="button"
            class="pq-main"
            @click="openPreview(pq)"
            :aria-label="`Preview ${pq.title || 'past question'}`"
          >
            <div class="pq-item-title">
              {{ pq.title }}
            </div>

            <div class="pq-item-meta">
              <span v-if="pq.session">{{ pq.session }}</span>
              <span v-if="pq.session && pq.semester" class="dot">•</span>
              <span v-if="pq.semester">{{ pq.semester }}</span>
              <span v-if="pq.uploadedAt" class="dot">•</span>
              <span v-if="pq.uploadedAt">{{ pq.uploadedAt }}</span>
            </div>
          </button>

          <!-- Quick save (small) -->
          <button
            type="button"
            class="pq-save"
            @click.stop="toggleSave(pq)"
            :aria-pressed="data.isSaved('pastQuestions', pq.id) ? 'true' : 'false'"
            :title="data.isSaved('pastQuestions', pq.id) ? 'Saved' : 'Save for later'"
          >
            {{ data.isSaved('pastQuestions', pq.id) ? 'Saved' : 'Save' }}
          </button>
        </div>

        <!-- Mobile-first actions: one strong CTA -->
        <div class="pq-item-actions">
          <AppButton class="w-full" variant="primary" size="sm" @click.stop="openPreview(pq)">
            Preview
          </AppButton>

          <details class="pq-more" @click.stop>
            <summary class="pq-more-btn" aria-label="More options">⋯</summary>
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

          <!-- Desktop extras -->
          <div class="hidden sm:flex sm:items-center sm:gap-2">
            <AppButton variant="ghost" size="sm" @click.stop="toggleSave(pq)">
              {{ data.isSaved('pastQuestions', pq.id) ? 'Saved' : 'Save' }}
            </AppButton>
            <a
              class="btn btn-ghost btn-sm"
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
      :docType="'pastquestions'"
      :docId="openItem?.id || ''"
      :open="!!openItem"
      :title="openItem?.title || 'Past question'"
      :url="openItem?.fileUrl || ''"
      @close="openItem = null"
    />
  </div>
</template>

<style scoped>
/* Give the list room above your bottom nav (prevents “hidden under nav”) */
.pq-page {
  padding-bottom: 5.5rem;
}

/* Make the toolbar compact on mobile */
.pq-toolbar {
  padding: 0.65rem !important;
}

@media (min-width: 640px) {
  .pq-toolbar {
    padding: 1.1rem !important;
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(6px);
  }
}

/* Header row */
.pq-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.pq-title-wrap {
  min-width: 0;
}
.pq-title {
  font-weight: 800;
  font-size: 1.05rem;
  line-height: 1.2rem;
}
@media (min-width: 640px) {
  .pq-title {
    font-size: 1.25rem;
    line-height: 1.5rem;
  }
}

.pq-count {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  opacity: 0.8;
}

/* Segmented All/Saved */
.pq-seg {
  display: inline-flex;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  padding: 0.2rem;
  gap: 0.2rem;
  flex-shrink: 0;
}
.pq-seg-btn {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0.35rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  line-height: 1rem;
  opacity: 0.85;
}
.pq-seg-btn.active {
  background: rgba(255, 255, 255, 0.12);
  opacity: 1;
}

/* Controls row */
.pq-controls {
  margin-top: 0.55rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: center;
}

.pq-search {
  position: relative;
  min-width: 0;
}
.pq-search-input {
  min-width: 0;
}

/* Tighten AppInput on mobile */
.pq-search :deep(input) {
  height: 2.55rem;
  padding-right: 2.25rem;
  font-size: 0.9rem;
}

/* Clear button inside the search field */
.pq-clear {
  position: absolute;
  right: 0.35rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-size: 1.1rem;
  line-height: 1rem;
}

.pq-filters-btn {
  height: 2.55rem;
  padding: 0 0.7rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
}

.pq-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.2rem;
  height: 1.2rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.pq-filters {
  margin-top: 0.5rem;
}

.pq-filter-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.45rem;
}
.pq-filter-hint {
  font-size: 0.75rem;
  opacity: 0.75;
}

/* Items: more compact mobile card */
.pq-item {
  padding: 0.7rem;
}
@media (min-width: 640px) {
  .pq-item {
    padding: 0.95rem;
  }
}

.pq-item-top {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  justify-content: space-between;
}

.pq-main {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}

.pq-main:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.22);
  outline-offset: 3px;
  border-radius: 0.75rem;
}

.pq-item-title {
  font-weight: 850;
  font-size: 0.98rem;
  line-height: 1.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (min-width: 640px) {
  .pq-item-title {
    font-size: 1.1rem;
    line-height: 1.35rem;
  }
}

.pq-item-meta {
  margin-top: 0.35rem;
  font-size: 0.78rem;
  opacity: 0.78;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.dot {
  opacity: 0.6;
}

/* Small “Save” button */
.pq-save {
  flex-shrink: 0;
  height: 2.05rem;
  padding: 0 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font-size: 0.8rem;
}

/* Actions: primary + more on mobile */
.pq-item-actions {
  margin-top: 0.65rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: center;
}

/* Mobile “more” menu */
.pq-more {
  position: relative;
}
.pq-more > summary {
  list-style: none;
}
.pq-more > summary::-webkit-details-marker {
  display: none;
}
.pq-more-btn {
  width: 2.55rem;
  height: 2.55rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font-size: 1.4rem;
  line-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pq-more-menu {
  position: absolute;
  right: 0;
  margin-top: 0.4rem;
  min-width: 11rem;
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(10, 14, 24, 0.95);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  z-index: 20;
}
</style>
