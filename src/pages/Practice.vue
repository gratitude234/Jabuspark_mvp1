<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'

const route = useRoute()
const router = useRouter()
const content = useContentStore()
const data = useDataStore()

const bankId = computed(() => route.params.bankId || route.params.id)
const resume = computed(() => String(route.query.resume || '') === '1')

const qIndex = ref(0)
const selected = ref(null)
const reveal = ref(false)
const busy = ref(false)
const error = ref('')

const startedAtMs = ref(Date.now())
watch(qIndex, () => {
  startedAtMs.value = Date.now()
})

const bank = computed(() => content.bank)
const questions = computed(() => bank.value?.questions || [])
const current = computed(() => questions.value[qIndex.value] || null)

const bankStats = computed(() => data.answers?.[bankId.value] || { answeredIds: [], correctIds: [] })
const answeredIds = computed(() => bankStats.value.answeredIds || [])
const correctIds = computed(() => bankStats.value.correctIds || [])
const answeredCount = computed(() => answeredIds.value.length || 0)
const correctCount = computed(() => correctIds.value.length || 0)
const accuracy = computed(() => (answeredCount.value ? Math.round((correctCount.value / answeredCount.value) * 100) : 0))

const progressPct = computed(() => {
  const total = questions.value.length || 0
  if (!total) return 0
  return Math.min(100, Math.round(((qIndex.value + 1) / total) * 100))
})

const isFinished = computed(() => {
  const total = questions.value.length || 0
  return total > 0 && answeredCount.value >= total
})

function optionLabel(i) {
  return ['A', 'B', 'C', 'D', 'E'][i] || String(i + 1)
}

function resetLocalState() {
  qIndex.value = 0
  selected.value = null
  reveal.value = false
  error.value = ''
  startedAtMs.value = Date.now()
}

function firstUnansweredIndex() {
  const set = new Set((answeredIds.value || []).map(String))
  const list = questions.value || []
  for (let i = 0; i < list.length; i++) {
    if (!set.has(String(list[i].id))) return i
  }
  return 0
}

function resumeIndex() {
  // Prefer lastActive.questionId if present
  const last = data.progress.lastActive
  if (resume.value && last?.bankId && String(last.bankId) === String(bankId.value) && last.questionId) {
    const idx = (questions.value || []).findIndex(q => String(q.id) === String(last.questionId))
    if (idx >= 0) return idx
  }
  // Otherwise go to first unanswered
  return firstUnansweredIndex()
}

async function load(id) {
  busy.value = true
  error.value = ''
  try {
    await Promise.allSettled([content.fetchBank(id), data.fetchProgress()])
    // After bank loads, set index for resume if needed
    qIndex.value = resumeIndex()
  } catch (e) {
    error.value = e?.message || 'Failed to load bank.'
  } finally {
    busy.value = false
  }
}

watch(
  bankId,
  async (id) => {
    if (!id) return
    resetLocalState()
    await load(id)
  },
  { immediate: true }
)

function pick(i) {
  if (reveal.value) return
  selected.value = i
}

async function submit() {
  if (!current.value) return
  if (selected.value === null || selected.value === undefined) return
  if (busy.value) return

  busy.value = true
  error.value = ''
  try {
    const secondsSpent = Math.max(0, Math.round((Date.now() - startedAtMs.value) / 1000))
    const res = await data.submitAnswer({
      bankId: bankId.value,
      questionId: current.value.id,
      selectedIndex: selected.value,
      secondsSpent
    })

    // If backend doesn't set lastActive, allow optimistic set if method exists
    if (!data.progress.lastActive?.bankId && typeof data.setLastActive === 'function') {
      data.setLastActive({ bankId: bankId.value, questionId: current.value.id })
    }

    reveal.value = true
    return res
  } catch (e) {
    error.value = e?.message || 'Failed to submit answer.'
  } finally {
    busy.value = false
  }
}

function next() {
  if (!questions.value.length) return
  const total = questions.value.length
  if (qIndex.value < total - 1) {
    qIndex.value += 1
    selected.value = null
    reveal.value = false
  }
}

function prev() {
  if (!questions.value.length) return
  if (qIndex.value > 0) {
    qIndex.value -= 1
    selected.value = null
    reveal.value = false
  }
}

async function resetBank() {
  if (!bankId.value) return
  busy.value = true
  error.value = ''
  try {
    await data.resetBank(bankId.value)
    await data.fetchProgress()
    // Restart at beginning
    qIndex.value = 0
    selected.value = null
    reveal.value = false
  } catch (e) {
    error.value = e?.message || 'Failed to reset bank.'
  } finally {
    busy.value = false
  }
}

function keyHandler(e) {
  if (!current.value) return
  if (busy.value) return

  const key = String(e.key || '').toLowerCase()

  // A/B/C/D selection
  const map = { a: 0, b: 1, c: 2, d: 3, '1': 0, '2': 1, '3': 2, '4': 3 }
  if (!reveal.value && key in map) {
    e.preventDefault()
    pick(map[key])
    return
  }

  // Enter = submit (if not revealed) else next
  if (key === 'enter') {
    e.preventDefault()
    if (!reveal.value) submit()
    else next()
  }

  if (key === 'arrowright') {
    e.preventDefault()
    if (reveal.value) next()
  }
  if (key === 'arrowleft') {
    e.preventDefault()
    if (reveal.value) prev()
  }
}

onMounted(() => {
  window.addEventListener('keydown', keyHandler)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', keyHandler)
})

const isSaved = computed(() => {
  if (!current.value) return false
  return typeof data.isSaved === 'function' ? data.isSaved('questions', current.value.id) : false
})

async function toggleSaveQuestion() {
  if (!current.value) return
  if (busy.value) return
  busy.value = true
  try {
    if (typeof data.toggleSave === 'function') {
      await data.toggleSave('questions', current.value.id)
    }
  } finally {
    busy.value = false
  }
}

const currentIsCorrect = computed(() => {
  if (!reveal.value || !current.value) return null
  const ans = current.value.answerIndex
  if (typeof ans !== 'number') return null
  return selected.value === ans
})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="h1 truncate">{{ bank?.title || 'Practice bank' }}</div>
          <p class="sub mt-1">
            Question {{ Math.min(qIndex + 1, questions.length || 1) }} of {{ questions.length || 0 }}
            <span class="text-text-3">•</span>
            {{ accuracy }}% accuracy
          </p>
        </div>

        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost" @click="router.push('/practice')">Back</button>
          <button type="button" class="btn btn-ghost" :disabled="busy" @click="resetBank">Reset</button>
        </div>
      </div>

      <div class="mt-4">
        <div class="h-2 rounded-full bg-bg-2 overflow-hidden">
          <div class="h-2 bg-accent" :style="{ width: progressPct + '%' }"></div>
        </div>
        <div class="mt-2 text-xs text-text-3">
          Answered {{ answeredCount }}/{{ questions.length || 0 }}
        </div>
      </div>

      <div v-if="error" class="alert alert-warn mt-4" role="alert">
        <div class="flex items-center justify-between gap-2">
          <span>{{ error }}</span>
          <button type="button" class="btn btn-ghost" @click="load(bankId)">Retry</button>
        </div>
      </div>
    </AppCard>

    <AppCard v-if="busy && !bank">
      <div class="grid gap-2">
        <div class="skeleton h-12" />
        <div class="skeleton h-20" />
        <div class="skeleton h-12" />
      </div>
    </AppCard>

    <AppCard v-else-if="!questions.length">
      <div class="h2">No questions yet</div>
      <p class="sub mt-1">This bank has no questions. Try a different bank.</p>
      <div class="mt-3">
        <button type="button" class="btn btn-ghost" @click="router.push('/practice')">Back to banks</button>
      </div>
    </AppCard>

    <!-- Summary -->
    <AppCard v-else-if="isFinished">
      <div class="h2">Bank complete 🎉</div>
      <p class="sub mt-1">Here’s your result for this bank.</p>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <div class="card card-pad">
          <div class="text-xs text-text-3">Answered</div>
          <div class="text-xl font-extrabold">{{ answeredCount }}</div>
        </div>
        <div class="card card-pad">
          <div class="text-xs text-text-3">Correct</div>
          <div class="text-xl font-extrabold">{{ correctCount }}</div>
        </div>
        <div class="card card-pad">
          <div class="text-xs text-text-3">Accuracy</div>
          <div class="text-xl font-extrabold">{{ accuracy }}%</div>
        </div>
      </div>

      <div class="mt-5 flex flex-col sm:flex-row gap-2">
        <AppButton @click="router.push('/practice')">Back to banks</AppButton>
        <button type="button" class="btn btn-ghost" :disabled="busy" @click="resetBank">Retry bank</button>
      </div>

      <p class="help mt-3">
        Tip: use the Review page to fix wrong answers and improve accuracy.
      </p>
    </AppCard>

    <!-- Question -->
    <AppCard v-else>
      <div class="card-pad">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-extrabold">Question</div>
            <div class="text-base mt-2 whitespace-pre-line">{{ current?.question }}</div>
          </div>

          <button type="button" class="btn btn-ghost" :disabled="busy" @click="toggleSaveQuestion">
            {{ isSaved ? 'Saved' : 'Save' }}
          </button>
        </div>

        <div class="mt-4 grid gap-2">
          <button
            v-for="(opt, i) in (current?.options || [])"
            :key="i"
            type="button"
            class="card card-press card-pad text-left"
            :disabled="busy"
            :aria-pressed="selected === i"
            @click="pick(i)"
          >
            <div class="flex items-start gap-3">
              <span class="badge">{{ optionLabel(i) }}</span>
              <div class="min-w-0">
                <div class="text-sm whitespace-pre-line">{{ opt }}</div>

                <div v-if="reveal && typeof current?.answerIndex === 'number'" class="text-xs mt-1"
                  :class="{
                    'text-accent': i === current.answerIndex,
                    'text-text-3': i !== current.answerIndex
                  }"
                >
                  <span v-if="i === current.answerIndex">Correct answer</span>
                  <span v-else-if="selected === i">Your pick</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div v-if="reveal && current?.explanation" class="mt-4 card card-pad">
          <div class="text-sm font-extrabold">Explanation</div>
          <div class="text-sm text-text-2 mt-2 whitespace-pre-line">{{ current.explanation }}</div>
        </div>

        <div v-if="reveal && currentIsCorrect !== null" class="mt-3 text-sm"
          :class="currentIsCorrect ? 'text-accent' : 'text-warn'">
          {{ currentIsCorrect ? 'Correct ✅' : 'Not quite ❌' }}
        </div>

        <div class="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div class="flex gap-2">
            <button type="button" class="btn btn-ghost" :disabled="busy || qIndex === 0 || !reveal" @click="prev">
              Prev
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="busy || qIndex >= (questions.length - 1) || !reveal"
              @click="next"
            >
              Next
            </button>
          </div>

          <div class="flex gap-2">
            <button
              v-if="!reveal"
              type="button"
              class="btn btn-primary"
              :disabled="busy || selected === null"
              @click="submit"
            >
              Submit
            </button>

            <button
              v-else
              type="button"
              class="btn btn-primary"
              :disabled="busy"
              @click="next"
            >
              Continue
            </button>
          </div>
        </div>

        <p class="help mt-3">
          Shortcuts: A/B/C/D to pick • Enter to submit/continue • ←/→ after reveal.
        </p>
      </div>
    </AppCard>
  </div>
</template>
