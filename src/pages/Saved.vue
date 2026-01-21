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

const tab = ref('pastQuestions') // pastQuestions | questions
const query = ref('')

const loading = ref({ pastQuestions: false, questions: false })
const error = ref({ pastQuestions: '', questions: '' })

const pastQuestions = ref([])
const questions = ref([])

const totals = ref({ pastQuestions: 0, questions: 0 })

// Question expand state
const expanded = ref({}) // { [questionId]: boolean }

// PDF modal
const openItem = ref(null)

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
  if (kind == 'pastQuestions' && pastQuestions.value.length === 0 && !loading.value.pastQuestions) {
    await loadPastQuestions()
  }
  if (kind == 'questions' && questions.value.length === 0 && !loading.value.questions) {
    await loadQuestions()
  }
}

async function reload(kind) {
  if (kind === 'pastQuestions') return loadPastQuestions()
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
  const s = data.progress?.saved || { pastQuestions: [], questions: [] }
  return {
    pastQuestions: s.pastQuestions?.length || 0,
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

function openPreview(item) {
  openItem.value = item
}

function closePreview() {
  openItem.value = null
}

async function unsave(kind, id) {
  try {
    await data.toggleSave(kind, id)
    toast('Removed from saved', 'ok')

    if (kind === 'pastQuestions') {
      pastQuestions.value = (pastQuestions.value || []).filter((x) => x.id !== id)
      totals.value.pastQuestions = Math.max(0, totals.value.pastQuestions - 1)
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
            Bookmarks you can jump back to anytime, including individual questions.
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

      <!-- Search + actions -->
      <div class="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1">
          <AppInput v-model="query" placeholder="Search saved items..." />
        </div>

        <AppButton
          class="w-full sm:w-auto"
          variant="ghost"
          :disabled="currentLoading"
          @click="reload(tab)"
        >
          Refresh
        </AppButton>
      </div>

      <!-- Status -->
      <div class="mt-4 flex items-center justify-between text-xs text-text-3">
        <div>
          <span v-if="currentLoading">Loading...</span>
          <span v-else>
            Showing <span class="font-semibold text-text">{{ currentTotal }}</span>
          </span>
        </div>
        <div v-if="currentError" class="text-warn">{{ currentError }}</div>
      </div>

      <div v-if="isEmpty && !currentLoading" class="mt-6 text-sm text-text-2">
        Nothing saved here yet.
      </div>

      <!-- Lists -->
      <div v-if="tab === 'pastQuestions'" class="mt-5 grid gap-3">
        <div v-for="pq in filteredPast" :key="pq.id" class="card card-pad">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-bold leading-snug">{{ pq.title }}</div>
              <div class="text-xs text-text-3 mt-1">
                <span v-if="pq.session">Session: {{ pq.session }}</span>
                <span v-if="pq.semester" class="ml-2">Semester: {{ pq.semester }}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <AppButton variant="ghost" class="h-10" @click="openPreview(pq)">Open</AppButton>
              <AppButton variant="ghost" class="h-10" @click="unsave('pastQuestions', pq.id)">Unsave</AppButton>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="mt-5 grid gap-3">
        <div v-for="qq in filteredQuestions" :key="qq.id" class="card card-pad">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-bold leading-snug">
                {{ qq.prompt }}
              </div>
              <div class="text-xs text-text-3 mt-1">
                <span v-if="qq.bankTitle">Bank: {{ qq.bankTitle }}</span>
                <span v-if="qq.courseCode" class="ml-2">Course: {{ qq.courseCode }}</span>
              </div>

              <button
                type="button"
                class="mt-3 text-xs font-semibold text-accent hover:opacity-90"
                @click="toggleExpandQuestion(qq.id)"
              >
                {{ expanded[qq.id] ? 'Hide details' : 'Show details' }}
              </button>

              <div v-if="expanded[qq.id]" class="mt-2 text-sm whitespace-pre-line">
                <div v-if="qq.options?.length" class="mt-1">
                  <div class="text-xs font-semibold text-text-2">Options</div>
                  <ul class="list-disc ml-5 mt-1">
                    <li v-for="(o, i) in qq.options" :key="i">{{ o }}</li>
                  </ul>
                </div>
                <div v-if="qq.correctIndex !== null && qq.correctIndex !== undefined" class="mt-2">
                  <div class="text-xs font-semibold text-text-2">Correct</div>
                  <div class="mt-1">Option {{ Number(qq.correctIndex) + 1 }}</div>
                </div>
                <div v-if="qq.explanation" class="mt-2">
                  <div class="text-xs font-semibold text-text-2">Explanation</div>
                  <div class="mt-1 whitespace-pre-line">{{ qq.explanation }}</div>
                </div>
              </div>
            </div>

            <div class="flex gap-2">
              <AppButton variant="ghost" class="h-10" @click="unsave('questions', qq.id)">Unsave</AppButton>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- PDF modal for past questions -->
    <PdfModal
      v-if="openItem"
      :title="openItem?.title || 'Past question'"
      :url="openItem?.fileUrl || ''"
      @close="closePreview"
    />
  </div>
</template>
