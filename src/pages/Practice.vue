<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import { useAiStore } from '../stores/ai'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import { toast } from '../utils/toast'

const route = useRoute()
const router = useRouter()
const content = useContentStore()
const data = useDataStore()
const ai = useAiStore()

const bankId = computed(() => route.params.bankId || route.params.id)

const mode = computed(() => String(route.query.mode || 'normal')) // normal | retry | wrong | timed
const mins = computed(() => {
  const n = Number(route.query.mins || 0)
  return Number.isFinite(n) && n > 0 ? n : 10
})

const sessionQuestions = ref([]) // questions for current session (can be shuffled/filtered)
const qStartedAt = ref(Date.now())

const remaining = ref(0)
const timeUp = ref(false)
let timerId = null

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function startTimerIfNeeded() {
  if (timerId) window.clearInterval(timerId)
  timerId = null
  timeUp.value = false

  if (mode.value !== 'timed') {
    remaining.value = 0
    return
  }

  remaining.value = Math.max(60, Math.round(mins.value * 60))
  timerId = window.setInterval(() => {
    if (remaining.value <= 0) {
      timeUp.value = true
      window.clearInterval(timerId)
      timerId = null
      return
    }
    remaining.value -= 1
  }, 1000)
}

function setMode(next) {
  const q = { ...(route.query || {}) }
  if (!next || next === 'normal') {
    delete q.mode
    delete q.mins
  } else {
    q.mode = next
    if (next === 'timed') q.mins = String(mins.value || 10)
    else delete q.mins
  }
  router.replace({ query: q })
}

function setTimedMins(m) {
  const q = { ...(route.query || {}), mode: 'timed', mins: String(m) }
  router.replace({ query: q })
}

function formatRemaining() {
  const s = Math.max(0, remaining.value)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

const qIndex = ref(0)
const selected = ref(null)
const reveal = ref(false)
const busy = ref(false)
const error = ref('')

const aiHint = ref('')
const aiExplanation = ref(null)
const aiBusy = ref(false)
const aiError = ref('')

const bank = computed(() => content.bank)
const questions = computed(() => bank.value?.questions || [])
const totalInSession = computed(() => sessionQuestions.value.length || 0)
const current = computed(() => sessionQuestions.value[qIndex.value] || null)

// ✅ Deep link support: /practice/:bankId?qid=<questionId>
const jumpQuestionId = computed(() => String(route.query.qid || '').trim())

const bankStats = computed(() => data.answers?.[bankId.value] || { answeredIds: [], correctIds: [] })
const answeredCount = computed(() => bankStats.value.answeredIds?.length || 0)
const correctCount = computed(() => bankStats.value.correctIds?.length || 0)
const accuracy = computed(() =>
  answeredCount.value ? Math.round((correctCount.value / answeredCount.value) * 100) : 0
)

const progressPct = computed(() => {
  const total = totalInSession.value
  if (!total) return 0
  // qIndex is zero-based; clamp just in case
  return Math.min(100, Math.round(((Math.min(qIndex.value, total - 1) + 1) / total) * 100))
})

watch(bankId, async (id) => {
  if (!id) return
  qIndex.value = 0
  selected.value = null
  reveal.value = false
  aiHint.value = ''
  aiExplanation.value = null
  aiError.value = ''
  await load(id)
  buildSessionQuestions()
  startTimerIfNeeded()
  qStartedAt.value = Date.now()
})

watch(mode, () => {
  qIndex.value = 0
  selected.value = null
  reveal.value = false
  buildSessionQuestions()
  startTimerIfNeeded()
  qStartedAt.value = Date.now()
})

watch(mins, () => {
  startTimerIfNeeded()
})

watch(qIndex, () => {
  qStartedAt.value = Date.now()
  aiHint.value = ''
  aiExplanation.value = null
  aiError.value = ''
  aiBusy.value = false
})

function buildSessionQuestions() {
  const all = questions.value || []
  const stats = bankStats.value || { answeredIds: [], correctIds: [] }

  let q = [...all] // default: keep original order

  if (mode.value === 'wrong') {
    const answered = new Set(stats.answeredIds || [])
    const correct = new Set(stats.correctIds || [])
    const wrongIds = [...answered].filter((id) => !correct.has(id))
    const wrongSet = new Set(wrongIds)
    q = q.filter((qq) => wrongSet.has(qq.id))
    q = shuffle(q)
  } else if (mode.value === 'retry' || mode.value === 'timed') {
    q = shuffle(q)
  }

  sessionQuestions.value = q
  if (qIndex.value >= q.length) qIndex.value = 0

  // Apply deep-link jump if present.
  applyJumpIfNeeded()
}

function applyJumpIfNeeded() {
  const qid = jumpQuestionId.value
  if (!qid) return
  if (!Array.isArray(questions.value) || questions.value.length === 0) return

  const idx = (sessionQuestions.value || []).findIndex((qq) => String(qq.id) === qid)
  if (idx >= 0) {
    qIndex.value = idx

    // Remove qid from URL once consumed so mode switches don't keep jumping.
    const next = { ...(route.query || {}) }
    delete next.qid
    router.replace({ query: next })
    return
  }

  // If a user opens a saved question while in a filtered mode (e.g. "wrong"),
  // the question may not be in the current session list. Force normal mode once.
  if (mode.value !== 'normal') {
    setMode('normal')
  } else {
    // Not found even in normal mode; drop the param to avoid loops.
    const next = { ...(route.query || {}) }
    delete next.qid
    router.replace({ query: next })
  }
}

const isSavedQuestion = computed(() => !!(current.value?.id && data.isSaved?.('questions', current.value.id)))

async function toggleSaveQuestion() {
  if (!current.value?.id) return
  try {
    const before = isSavedQuestion.value
    await data.toggleSave('questions', current.value.id)
    toast(before ? 'Removed from saved questions' : 'Saved question', 'ok')
  } catch (e) {
    toast(e?.message || 'Failed to update saved questions', 'warn')
  }
}

async function load(id) {
  error.value = ''
  await content.fetchBank(id)
  if (!content.bank || !content.bank.questions?.length) {
    error.value = 'This bank has no questions yet.'
  }
}

onMounted(async () => {
  await data.fetchProgress()
  await load(bankId.value)
  buildSessionQuestions()
  startTimerIfNeeded()
})

onUnmounted(() => {
  if (timerId) window.clearInterval(timerId)
  timerId = null
})

function pick(i) {
  if (reveal.value) return
  if (mode.value === 'timed' && timeUp.value) return
  selected.value = i
}

async function submit() {
  if (!current.value) return
  if (selected.value === null) return
  if (mode.value === 'timed' && timeUp.value) return

  busy.value = true
  try {
    const secondsSpent = Math.max(0, Math.round((Date.now() - qStartedAt.value) / 1000))
    const res = await data.submitAnswer({
      bankId: bankId.value,
      questionId: current.value.id,
      selectedIndex: selected.value,
      secondsSpent
    })

    reveal.value = true

    // Auto AI explanation after submit
    await getAiExplanation()

    return res
  } catch (e) {
    error.value = e?.message || 'Failed to submit answer.'
  } finally {
    busy.value = false
  }
}

async function getAiHint() {
  if (!current.value) return
  aiBusy.value = true
  aiError.value = ''
  try {
    const res = await ai.explainMCQ({
      bankId: bankId.value,
      questionId: current.value.id,
      mode: 'hint',
      selectedIndex: selected.value
    })
    aiHint.value = res?.hint || res?.text || ''
  } catch (e) {
    aiError.value = e?.message || 'AI hint failed'
  } finally {
    aiBusy.value = false
  }
}

async function getAiExplanation() {
  if (!current.value) return
  aiBusy.value = true
  aiError.value = ''
  try {
    const res = await ai.explainMCQ({
      bankId: bankId.value,
      questionId: current.value.id,
      mode: 'full',
      selectedIndex: selected.value
    })
    aiExplanation.value = res || null
  } catch (e) {
    aiError.value = e?.message || 'AI explanation failed'
  } finally {
    aiBusy.value = false
  }
}

function next() {
  // IMPORTANT: use sessionQuestions length (not bank.questions length)
  if (qIndex.value < sessionQuestions.value.length - 1) {
    qIndex.value++
    selected.value = null
    reveal.value = false
  }
}

async function resetBank() {
  busy.value = true
  error.value = ''
  try {
    await data.resetBank(bankId.value)
    qIndex.value = 0
    selected.value = null
    reveal.value = false
    buildSessionQuestions()
    startTimerIfNeeded()
  } catch (e) {
    error.value = e?.message || 'Failed to reset bank.'
  } finally {
    busy.value = false
  }
}

function backToBanks() {
  router.push('/practice')
}
</script>

<template>
  <div class="page space-y-3">
    <!-- Header (NOT sticky on mobile) -->
    <AppCard>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="min-w-0">
            <div class="kicker">Practice bank</div>
            <div class="h1 mt-1 line-clamp-2 sm:line-clamp-none">{{ bank?.title || 'Loading…' }}</div>
            <p class="sub mt-2">Answer, reveal, then move fast. Keep it focused.</p>

            <!-- Modes: mobile horizontal scroll (prevents ugly wrapping) -->
            <div class="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
              <div class="mode-row">
                <span class="text-xs text-text-3">Mode:</span>

                <button
                  type="button"
                  class="btn btn-ghost btn-sm mode-btn"
                  :class="mode === 'normal' ? 'ring-1 ring-accent/50' : ''"
                  @click="setMode('normal')"
                >Normal</button>

                <button
                  type="button"
                  class="btn btn-ghost btn-sm mode-btn"
                  :class="mode === 'retry' ? 'ring-1 ring-accent/50' : ''"
                  @click="setMode('retry')"
                >Retry</button>

                <button
                  type="button"
                  class="btn btn-ghost btn-sm mode-btn"
                  :class="mode === 'wrong' ? 'ring-1 ring-accent/50' : ''"
                  @click="setMode('wrong')"
                >Wrong</button>

                <button
                  type="button"
                  class="btn btn-ghost btn-sm mode-btn"
                  :class="mode === 'timed' ? 'ring-1 ring-accent/50' : ''"
                  @click="setMode('timed')"
                >Timed CBT</button>

                <span v-if="mode === 'timed'" class="badge badge-warn whitespace-nowrap">
                  Time left: {{ formatRemaining() }}
                </span>
              </div>
            </div>

            <!-- Timer presets: also scroll on mobile -->
            <div v-if="mode === 'timed'" class="mt-2 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
              <div class="timer-row">
                <span class="text-xs text-text-3">Timer:</span>
                <button type="button" class="btn btn-ghost btn-sm mode-btn" @click="setTimedMins(5)">5m</button>
                <button type="button" class="btn btn-ghost btn-sm mode-btn" @click="setTimedMins(10)">10m</button>
                <button type="button" class="btn btn-ghost btn-sm mode-btn" @click="setTimedMins(20)">20m</button>
                <button type="button" class="btn btn-ghost btn-sm mode-btn" @click="setTimedMins(30)">30m</button>
              </div>
            </div>
          </div>

          <!-- Top actions: bigger tap targets + full width on mobile -->
          <div class="w-full sm:w-auto grid grid-cols-2 sm:flex gap-2">
            <button class="btn btn-ghost btn-sm h-11 w-full" @click="backToBanks">Banks</button>
            <button class="btn btn-ghost btn-sm h-11 w-full" :disabled="busy" @click="resetBank">Reset</button>
          </div>
        </div>

        <!-- Stats: 2 columns on mobile (less cramped), 4 on desktop -->
        <div class="grid gap-2 grid-cols-2 sm:grid-cols-4">
          <div class="glass rounded-xl2 border border-stroke/60 px-4 py-3">
            <div class="text-xs text-text-3">Progress</div>
            <div class="text-sm font-bold mt-1">{{ qIndex + 1 }} / {{ totalInSession || 0 }}</div>
          </div>
          <div class="glass rounded-xl2 border border-stroke/60 px-4 py-3">
            <div class="text-xs text-text-3">Answered</div>
            <div class="text-sm font-bold mt-1">{{ answeredCount }}</div>
          </div>
          <div class="glass rounded-xl2 border border-stroke/60 px-4 py-3">
            <div class="text-xs text-text-3">Accuracy</div>
            <div class="text-sm font-bold mt-1">{{ accuracy }}%</div>
          </div>
          <div class="glass rounded-xl2 border border-stroke/60 px-4 py-3">
            <div class="text-xs text-text-3">Correct</div>
            <div class="text-sm font-bold mt-1">{{ correctCount }}</div>
          </div>
        </div>

        <div class="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div class="h-full bg-accent transition-all duration-200" :style="{ width: progressPct + '%' }" />
        </div>

        <div v-if="content.loading.bank" class="grid gap-2">
          <div class="skeleton h-24" />
          <div class="skeleton h-12" />
          <div class="skeleton h-12" />
        </div>

        <div v-else-if="error" class="alert alert-warn" role="alert">{{ error }}</div>
      </div>
    </AppCard>

    <AppCard v-if="!content.loading.bank && current" class="relative">
      <div v-if="timeUp" class="alert alert-warn mb-3" role="alert">
        Time is up. You can still review your stats, or go back.
      </div>

      <div class="flex items-center justify-between gap-2">
        <div class="kicker">Question {{ qIndex + 1 }}</div>
        <button
          type="button"
          class="btn btn-ghost btn-sm h-10 whitespace-nowrap"
          @click="toggleSaveQuestion"
          :aria-label="isSavedQuestion ? 'Unsave question' : 'Save question'"
          :title="isSavedQuestion ? 'Unsave question' : 'Save question'"
        >
          <span v-if="isSavedQuestion">Saved ★</span>
          <span v-else>Save ☆</span>
        </button>
      </div>
      <div class="mt-1 text-lg sm:text-xl font-extrabold leading-snug">
        {{ current.question }}
      </div>

      <!-- Options: bigger tap target + clearer selected state on mobile -->
      <div class="mt-4 grid gap-2">
        <button
          v-for="(opt, i) in current.options"
          :key="i"
          type="button"
          class="option card card-press text-left"
          :class="[
            selected === i ? 'ring-2 ring-accent/55' : '',
            reveal && i === current.answerIndex ? 'ring-2 ring-accent/60 bg-accent/10' : '',
            reveal && selected === i && i !== current.answerIndex ? 'ring-2 ring-danger/50 bg-danger/10' : ''
          ]"
          @click="pick(i)"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5 h-7 w-7 rounded-full border border-stroke/60 grid place-items-center text-xs font-bold shrink-0">
              {{ String.fromCharCode(65 + i) }}
            </div>
            <div class="min-w-0">
              <div class="text-sm sm:text-base font-semibold text-text leading-snug">
                {{ opt }}
              </div>
              <div v-if="reveal && i === current.answerIndex" class="text-xs text-text-2 mt-1">Correct answer</div>
              <div v-else-if="reveal && selected === i && i !== current.answerIndex" class="text-xs text-danger mt-1">Your choice</div>
            </div>
          </div>
        </button>
      </div>

      <!-- AI hint (before reveal) -->
      <div v-if="!reveal" class="mt-4">
        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
          <button
            class="btn btn-ghost w-full sm:w-auto h-11"
            :disabled="aiBusy"
            @click="getAiHint"
          >
            <span v-if="!aiBusy">Get AI hint</span>
            <span v-else>Thinking…</span>
          </button>
          <p class="text-xs text-text-3">Use hints to learn faster — but still try first.</p>
        </div>

        <div v-if="aiError" class="alert alert-warn mt-3" role="alert">{{ aiError }}</div>
        <div v-else-if="aiHint" class="alert alert-ok mt-3" role="status">
          <div class="font-semibold">AI hint</div>
          <div class="mt-1 text-sm text-text-2">{{ aiHint }}</div>
        </div>
      </div>

      <div v-if="reveal" class="mt-4 alert alert-ok" role="status">
        <div class="font-semibold">Explanation</div>
        <div class="mt-1 text-sm text-text-2">{{ current.explanation || 'No explanation provided yet.' }}</div>
      </div>

      <!-- AI explanation (after reveal) -->
      <div v-if="reveal" class="mt-3">
        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
          <button
            class="btn btn-ghost w-full sm:w-auto h-11"
            :disabled="aiBusy"
            @click="getAiExplanation"
          >
            <span v-if="!aiBusy">Explain with AI</span>
            <span v-else>Thinking…</span>
          </button>
          <p class="text-xs text-text-3">Deeper explanation + why other options are wrong.</p>
        </div>

        <div v-if="aiError" class="alert alert-warn mt-3" role="alert">{{ aiError }}</div>
        <div v-else-if="aiExplanation" class="alert alert-ok mt-3" role="status">
          <div class="font-semibold">AI explanation</div>

          <div v-if="aiExplanation.explanation" class="mt-1 text-sm text-text-2">
            {{ aiExplanation.explanation }}
          </div>

          <ul v-if="aiExplanation.steps?.length" class="mt-2 text-sm text-text-2 list-disc pl-5">
            <li v-for="(s, i) in aiExplanation.steps" :key="i">{{ s }}</li>
          </ul>

          <ul v-if="aiExplanation.whyOthersAreWrong?.length" class="mt-2 text-sm text-text-2 list-disc pl-5">
            <li v-for="(s, i) in aiExplanation.whyOthersAreWrong" :key="'w'+i">{{ s }}</li>
          </ul>

          <div v-if="aiExplanation.keyTakeaway" class="mt-2 text-sm text-text-2">
            <span class="font-semibold">Key takeaway:</span> {{ aiExplanation.keyTakeaway }}
          </div>
        </div>
      </div>

      <!-- Primary actions: full-width on mobile -->
      <div class="mt-5 grid gap-2 sm:flex sm:flex-row">
        <AppButton
          v-if="!reveal"
          class="w-full sm:w-auto h-11"
          :disabled="busy || selected === null"
          @click="submit"
        >
          <span v-if="!busy">Reveal answer</span>
          <span v-else>Submitting…</span>
        </AppButton>

        <AppButton
          v-else
          class="w-full sm:w-auto h-11"
          :disabled="qIndex >= sessionQuestions.length - 1"
          @click="next"
        >
          Next question
        </AppButton>

        <button class="btn btn-ghost w-full sm:w-auto h-11" @click="backToBanks">Back to banks</button>
      </div>
    </AppCard>

    <AppCard v-else-if="!content.loading.bank" class="alert alert-ok" role="status">
      No questions to practice right now.
    </AppCard>
  </div>
</template>

<style scoped>
/* Horizontal-scroll rows to prevent cramped wrapping on phones */
.mode-row,
.timer-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: max-content;
  padding-bottom: 0.25rem; /* gives breathing room over scrollbar */
}

.mode-btn {
  height: 44px; /* better tap target */
  white-space: nowrap;
}

/* Option buttons: bigger touch area and nicer spacing */
.option {
  padding: 0.9rem 1rem; /* bigger than card-pad on phones */
}

@media (min-width: 640px) {
  .option {
    padding: 1rem 1.1rem;
  }
}
</style>
