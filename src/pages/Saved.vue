<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import AppInput from '../components/AppInput.vue'
import PdfModal from '../components/PdfModal.vue'
import { apiFetch, resolveFileUrl } from '../utils/api'
import { toast } from '../utils/toast'

const data = useDataStore()

const tab = ref('pastQuestions') // pastQuestions | materials | questions
const query = ref('')

const loading = ref({ pastQuestions: false, materials: false, questions: false })
const error = ref({ pastQuestions: '', materials: '', questions: '' })

const pastQuestions = ref([])
const materials = ref([])
const questions = ref([])

const totals = ref({ pastQuestions: 0, materials: 0, questions: 0 })

// Question expand state
const expanded = ref({}) // { [questionId]: boolean }

// PDF modal
const openItem = ref(null)
const openDocType = ref('') // 'materials' | 'pastquestions'

function normalizeText(v) {
  return (v || '').toString().trim().toLowerCase()
}

function normDoc(item) {
  return {
    ...item,
    fileUrl: resolveFileUrl(item?.fileUrl || ''),
  }
}

async function loadPastQuestions() {
  loading.value.pastQuestions = true
  error.value.pastQuestions = ''
  try {
    const res = await apiFetch('/saved/pastquestions?limit=200')
    const items = (res?.data?.items || []).map(normDoc)
    pastQuestions.value = items
    totals.value.pastQuestions = Number(res?.data?.total ?? items.length)
  } catch (e) {
    error.value.pastQuestions = e?.message || 'Failed to load saved past questions.'
    pastQuestions.value = []
    totals.value.pastQuestions = 0
  } finally {
    loading.value.pastQuestions = false
  }
}

async function loadMaterials() {
  loading.value.materials = true
  error.value.materials = ''
  try {
    const res = await apiFetch('/saved/materials?limit=200')
    const items = (res?.data?.items || []).map(normDoc)
    materials.value = items
    totals.value.materials = Number(res?.data?.total ?? items.length)
  } catch (e) {
    error.value.materials = e?.message || 'Failed to load saved materials.'
    materials.value = []
    totals.value.materials = 0
  } finally {
    loading.value.materials = false
  }
}

async function loadQuestions() {
  loading.value.questions = true
  error.value.questions = ''
  try {
    const res = await apiFetch('/saved/questions?limit=200')
    const items = res?.data?.items || []
    questions.value = items
    totals.value.questions = Number(res?.data?.total ?? items.length)
  } catch (e) {
    error.value.questions = e?.message || 'Failed to load saved questions.'
    questions.value = []
    totals.value.questions = 0
  } finally {
    loading.value.questions = false
  }
}

async function ensureLoaded(kind) {
  if (kind === 'pastQuestions' && pastQuestions.value.length === 0 && !loading.value.pastQuestions) {
    await loadPastQuestions()
  }
  if (kind === 'materials' && materials.value.length === 0 && !loading.value.materials) {
    await loadMaterials()
  }
  if (kind === 'questions' && questions.value.length === 0 && !loading.value.questions) {
    await loadQuestions()
  }
}

async function reload(kind) {
  if (kind === 'pastQuestions') return loadPastQuestions()
  if (kind === 'materials') return loadMaterials()
  return loadQuestions()
}

watch(tab, async (t) => {
  query.value = ''
  await ensureLoaded(t)
})

onMounted(async () => {
  await data.fetchProgress()
  await ensureLoaded(tab.value)
})

const savedCounts = computed(() => {
  const s = data.progress?.saved || { pastQuestions: [], materials: [], questions: [] }
  return {
    pastQuestions: s.pastQuestions?.length || 0,
    materials: s.materials?.length || 0,
    questions: s.questions?.length || 0,
  }
})

const filteredPast = computed(() => {
  const q = normalizeText(query.value)
  let list = pastQuestions.value || []
  if (q) {
    list = list.filter((pq) => {
      const hay = [pq.title, pq.session, pq.semester].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }
  return list
})

const filteredMaterials = computed(() => {
  const q = normalizeText(query.value)
  let list = materials.value || []
  if (q) {
    list = list.filter((m) => {
      const hay = [m.title, m.type, ...(m.tags || [])].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }
  return list
})

const filteredQuestions = computed(() => {
  const q = normalizeText(query.value)
  let list = questions.value || []
  if (q) {
    list = list.filter((qq) => {
      const hay = [qq.prompt, qq.bankTitle, qq.courseCode].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }
  return list
})

function openPreview(docType, item) {
  openDocType.value = docType
  openItem.value = item
}

function closePreview() {
  openItem.value = null
  openDocType.value = ''
}

async function unsave(kind, id) {
  try {
    await data.toggleSave(kind, id)
    toast('Removed from saved', 'ok')

    if (kind === 'pastQuestions') {
      pastQuestions.value = (pastQuestions.value || []).filter((x) => x.id !== id)
      totals.value.pastQuestions = Math.max(0, totals.value.pastQuestions - 1)
    } else if (kind === 'materials') {
      materials.value = (materials.value || []).filter((x) => x.id !== id)
      totals.value.materials = Math.max(0, totals.value.materials - 1)
    } else if (kind === 'questions') {
      questions.value = (questions.value || []).filter((x) => x.id !== id)
      totals.value.questions = Math.max(0, totals.value.questions - 1)
      expanded.value = { ...expanded.value, [id]: false }
    }
  } catch (e) {
    toast(e?.message || 'Failed to unsave', 'warn')
  }
}

function toggleExpandQuestion(id) {
  expanded.value = { ...expanded.value, [id]: !expanded.value?.[id] }
}

const isEmpty = computed(() => {
  if (tab.value === 'pastQuestions') return filteredPast.value.length === 0
  if (tab.value === 'materials') return filteredMaterials.value.length === 0
  return filteredQuestions.value.length === 0
})

const currentLoading = computed(() => loading.value?.[tab.value] || false)
const currentError = computed(() => error.value?.[tab.value] || '')
const currentTotal = computed(() => totals.value?.[tab.value] || 0)
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="min-w-0">
          <div class="h1">Saved</div>
          <p class="sub mt-1">
            Bookmarks you can jump back to anytime — including individual questions.
          </p>
        </div>

        <!-- Segmented tabs -->
        <div class="w-full sm:w-auto" role="tablist" aria-label="Saved tabs">
          <div class="overflow-x-auto -mx-4 px-4 sm:overflow-visible sm:mx-0 sm:px-0">
            <div class="seg flex w-max sm:w-auto gap-2">
              <button
                class="seg-btn h-11 px-4 whitespace-nowrap"
                :class="tab === 'pastQuestions' ? 'seg-btn--active' : 'seg-btn--inactive'"
                role="tab"
                :aria-selected="tab === 'pastQuestions'"
                type="button"
                @click="tab = 'pastQuestions'"
              >
                <span class="sm:hidden">Past Q</span>
                <span class="hidden sm:inline">Past questions</span>
                <span class="badge ml-2">{{ savedCounts.pastQuestions }}</span>
              </button>

              <button
                class="seg-btn h-11 px-4 whitespace-nowrap"
                :class="tab === 'materials' ? 'seg-btn--active' : 'seg-btn--inactive'"
                role="tab"
                :aria-selected="tab === 'materials'"
                type="button"
                @click="tab = 'materials'"
              >
                Materials
                <span class="badge ml-2">{{ savedCounts.materials }}</span>
              </button>

              <button
                class="seg-btn h-11 px-4 whitespace-nowrap"
                :class="tab === 'questions' ? 'seg-btn--active' : 'seg-btn--inactive'"
                role="tab"
                :aria-selected="tab === 'questions'"
                type="button"
                @click="tab = 'questions'"
              >
                Questions
                <span class="badge ml-2">{{ savedCounts.questions }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-2 sm:grid-cols-12 items-end">
        <div class="sm:col-span-8">
          <label class="label" for="savedSearch">Search saved</label>
          <AppInput id="savedSearch" v-model="query" placeholder="Search your saved items…" />
        </div>
        <div class="sm:col-span-4">
          <label class="label">&nbsp;</label>
          <div class="flex gap-2">
            <AppButton variant="ghost" class="w-full h-11" :disabled="currentLoading" @click="reload(tab)">
              Refresh
            </AppButton>
            <div class="badge badge-soft self-center whitespace-nowrap">
              {{ currentTotal }} total
            </div>
          </div>
        </div>
      </div>

      <div v-if="currentLoading" class="mt-4 grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>

      <div v-else-if="currentError" class="alert alert-warn mt-4" role="alert">
        {{ currentError }}
      </div>
    </AppCard>

    <!-- Past questions tab -->
    <AppCard v-if="tab === 'pastQuestions'">
      <div class="h2">Past questions</div>
      <p class="sub mt-1">Open instantly, ask AI questions, or remove bookmarks.</p>

      <div class="divider my-4" />

      <div v-if="!currentLoading && isEmpty" class="alert alert-ok" role="status">
        No saved past questions yet.
        <RouterLink to="/past-questions" class="underline text-accent font-semibold ml-1">Browse past questions</RouterLink>
      </div>

      <div v-else class="grid gap-3 sm:gap-2">
        <div v-for="pq in filteredPast" :key="pq.id" class="card card-pad">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-extrabold truncate">{{ pq.title }}</div>
              <div class="text-xs text-text-3 mt-1">{{ pq.session }} • {{ pq.semester }}</div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm" @click="openPreview('pastquestions', pq)">Preview</button>
              <button class="btn btn-ghost btn-sm" @click="unsave('pastQuestions', pq.id)">Unsave</button>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- Materials tab -->
    <AppCard v-else-if="tab === 'materials'">
      <div class="h2">Materials</div>
      <p class="sub mt-1">Your saved PDFs and notes — with one-tap preview.</p>

      <div class="divider my-4" />

      <div v-if="!currentLoading && isEmpty" class="alert alert-ok" role="status">
        No saved materials yet.
        <RouterLink to="/materials" class="underline text-accent font-semibold ml-1">Browse materials</RouterLink>
      </div>

      <div v-else class="grid gap-3 sm:gap-2">
        <div v-for="m in filteredMaterials" :key="m.id" class="card card-pad">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-extrabold truncate">{{ m.title }}</div>
              <div class="text-xs text-text-3 mt-1">
                <span v-if="m.type">{{ m.type }}</span>
                <span v-if="(m.tags || []).length"> • {{ (m.tags || []).slice(0, 4).join(', ') }}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm" @click="openPreview('materials', m)">Preview</button>
              <button class="btn btn-ghost btn-sm" @click="unsave('materials', m.id)">Unsave</button>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- Questions tab -->
    <AppCard v-else>
      <div class="h2">Saved questions</div>
      <p class="sub mt-1">Jump directly into a bank at the exact saved question.</p>

      <div class="divider my-4" />

      <div v-if="!currentLoading && isEmpty" class="alert alert-ok" role="status">
        No saved questions yet. While practicing, tap <span class="font-semibold">Save ☆</span> to bookmark a question.
        <RouterLink to="/practice" class="underline text-accent font-semibold ml-1">Go to practice</RouterLink>
      </div>

      <div v-else class="grid gap-3 sm:gap-2">
        <div v-for="q in filteredQuestions" :key="q.id" class="card card-pad">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs text-text-3">
                {{ q.courseCode || q.courseId }} • {{ q.bankTitle }}
                <span v-if="q.bankMode" class="badge badge-soft ml-2">{{ q.bankMode }}</span>
              </div>
              <div class="text-sm font-extrabold mt-1 line-clamp-2">
                {{ q.prompt }}
              </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-2">
              <RouterLink
                class="btn btn-ghost btn-sm whitespace-nowrap"
                :to="`/practice/${encodeURIComponent(q.bankId)}?qid=${encodeURIComponent(q.id)}`"
              >
                Open
              </RouterLink>
              <button class="btn btn-ghost btn-sm whitespace-nowrap" @click="toggleExpandQuestion(q.id)">
                {{ expanded[q.id] ? 'Hide' : 'Show' }}
              </button>
              <button class="btn btn-ghost btn-sm whitespace-nowrap" @click="unsave('questions', q.id)">Unsave</button>
            </div>
          </div>

          <div v-if="expanded[q.id]" class="mt-3 grid gap-2">
            <div class="text-xs text-text-3">Answer: {{ String.fromCharCode(65 + (q.answerIndex || 0)) }}</div>

            <div class="grid gap-1">
              <div
                v-for="(opt, i) in (q.options || [])"
                :key="i"
                class="rounded-xl border border-stroke/60 px-3 py-2 text-sm"
                :class="i === q.answerIndex ? 'bg-accent/10 ring-1 ring-accent/40' : 'bg-white/5'"
              >
                <span class="font-semibold">{{ String.fromCharCode(65 + i) }}.</span>
                <span class="ml-2">{{ opt }}</span>
              </div>
            </div>

            <div v-if="q.explanation" class="alert alert-ok" role="status">
              <div class="font-semibold">Explanation</div>
              <div class="mt-1 text-sm text-text-2">{{ q.explanation }}</div>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <PdfModal
      :open="!!openItem"
      :title="openItem?.title || 'Preview'"
      :url="openItem?.fileUrl || ''"
      :docType="openDocType"
      :docId="openItem?.id || ''"
      @close="closePreview"
    />
  </div>
</template>

<style scoped>
.card-pad {
  padding: 0.95rem;
}
</style>
